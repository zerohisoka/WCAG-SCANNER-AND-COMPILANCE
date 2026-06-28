import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isValidUrl } from '@/lib/utils';
import { PLANS } from '@/lib/stripe/plans';
import { z } from 'zod';

const scanRequestSchema = z.object({
  url: z.string().min(1, 'URL is required').refine(isValidUrl, 'Invalid URL format'),
  max_pages: z.number().int().min(1).max(200).optional().default(1),
  wcag_level: z.enum(['A', 'AA', 'AAA']).optional().default('AA'),
});

export async function POST(request: NextRequest) {
  try {
    // ── Auth client (respects RLS) ── used ONLY for reading user session
    const authClient = await createClient();

    // ── Service client (bypasses RLS) ── used for ALL DB writes
    const db = createServiceClient();

    // Get IP for tracking
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '0.0.0.0';

    // Parse and validate
    const body = await request.json();
    const parsed = scanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url, max_pages, wcag_level } = parsed.data;

    // Get user session
    const { data: { user } } = await authClient.auth.getUser();
    let userId: string | null = user?.id || null;
    let planLimits = PLANS.free.limits;
    let currentCount = 0;
    let isAnonymous = !userId;

    if (user) {
      // Check user limits
      const { data: profileData } = await db
        .from('profiles')
        .select('subscription_status, scans_used_this_month')
        .eq('id', user.id)
        .single();

      if (profileData) {
        planLimits = PLANS[profileData.subscription_status as keyof typeof PLANS]?.limits || PLANS.free.limits;
        currentCount = profileData.scans_used_this_month || 0;

        if (currentCount >= planLimits.scansPerMonth) {
          return NextResponse.json(
            {
              error: 'Scan limit reached',
              code: 'SCAN_LIMIT_REACHED',
              message: `You have used all ${planLimits.scansPerMonth} scans for this month. Upgrade to continue scanning.`,
            },
            { status: 429 }
          );
        }
      }
    } else {
      // ── Anonymous / free user — check free_scan_usage by IP ──
      const { data: usage } = await db
        .from('free_scan_usage')
        .select('id')
        .eq('ip_address', ip)
        .gte('scanned_at', new Date(Date.now() - 86_400_000).toISOString())
        .limit(1);

      if (usage && usage.length > 0) {
        return NextResponse.json(
          { error: 'Free scan limit reached. Sign up for more scans.' },
          { status: 429 }
        );
      }

      // Record this free scan
      await db.from('free_scan_usage').insert({ ip_address: ip, url });
    }

    // Anonymous: cap to 1 page
    const cappedPages = isAnonymous ? 1 : Math.min(max_pages, planLimits.pagesPerScan);

    // Insert scan record (service role bypasses RLS)
    const scanId = crypto.randomUUID();
    const { error: insertError } = await db.from('scans').insert({
      id: scanId,
      user_id: userId,
      url,
      status: 'pending',
      pages_requested: cappedPages,
      wcag_level,
      started_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Failed to insert scan:', insertError);
      return NextResponse.json({ error: 'Failed to create scan record' }, { status: 500 });
    }

    // Insert into reports table immediately
    if (userId) {
      const { data: report, error: reportError } = await db
        .from('reports')
        .insert({
          scan_id: scanId,
          user_id: userId,
          name: `Scan of ${url} - ${new Date().toLocaleDateString()}`,
          is_public: false,
        })
        .select()
        .single();

      if (reportError) {
        console.error('Failed to create report:', reportError);
      } else {
        console.log('Report created:', report?.id);
      }
    }

    // Increment scan count for authenticated users
    if (userId) {
      await db
        .from('profiles')
        .update({ scans_used_this_month: currentCount + 1 })
        .eq('id', userId);
    }

    // Trigger the scan asynchronously (fire and forget)
    triggerScan(scanId, url, cappedPages, wcag_level, isAnonymous, user?.email).catch(console.error);

    return NextResponse.json({
      scan_id: scanId,
      status: 'pending',
      message: 'Scan started successfully',
    });
  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function triggerScan(
  scanId: string,
  url: string,
  maxPages: number,
  wcagLevel: 'A' | 'AA' | 'AAA',
  isAnonymous: boolean = false,
  userEmail?: string | null,
) {
  // Service client — background writes bypass RLS
  const db = createServiceClient();

  try {
    // Mark as running
    await db.from('scans').update({ status: 'running' }).eq('id', scanId);

    // Dynamic import to avoid bundling puppeteer in edge
    const { runScan } = await import('@/lib/scanner/engine');
    const result = await runScan(url);

    // Update scan record
    const { error: updateError } = await db
      .from('scans')
      .update({
        status: 'completed',
        pages_scanned: 1,
        compliance_score: result.score,
        total_violations: result.totalViolations,
        critical_count: result.critical,
        serious_count: result.serious,
        moderate_count: result.moderate,
        minor_count: result.minor,
        big_six: result.bigSix as any,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId);

    if (updateError) {
      console.error('Failed to update scan:', updateError);
    }

    // Insert violations
    if (result.violations.length > 0) {
      const violationsToInsert = result.violations.map((v: any) => ({
        scan_id: scanId,
        rule_id: v.id,
        rule_description: v.description?.slice(0, 500) || v.help?.slice(0, 500) || '',
        impact: v.impact,
        wcag_criterion: 'N/A',
        wcag_level: wcagLevel,
        page_url: result.url,
        element_html: v.nodes?.[0]?.html?.slice(0, 1000) || '',
        element_selector: v.nodes?.[0]?.target?.join(' ')?.slice(0, 500) || '',
        fix_summary: v.help?.slice(0, 500) || '',
        fix_detail: v.description?.slice(0, 2000) || '',
        help_url: v.helpUrl || '',
      }));

      const { error: violationsError } = await db
        .from('violations')
        .insert(violationsToInsert);

      if (violationsError) {
        console.error('Failed to insert violations:', violationsError);
      }
    }

    // Send email notification for authenticated users
    if (userEmail && !isAnonymous) {
      try {
        const { sendScanCompleteEmail } = await import('@/lib/email/resend');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wcag-scanner-tau.vercel.app';
        await sendScanCompleteEmail(
          userEmail,
          url,
          result.score,
          result.totalViolations,
          scanId,
          appUrl
        );
      } catch (emailErr) {
        console.error('Failed to send scan complete email:', emailErr);
      }
    }

  } catch (error) {
    console.error('Scan failed:', error);
    await db
      .from('scans')
      .update({
        status: 'failed',
        error_message: (error as any)?.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId);
  }
}