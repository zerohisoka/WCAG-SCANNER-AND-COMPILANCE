'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  FileDown,
  Share2,
  Check,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
  BarChart2
} from 'lucide-react';
import type { ScanResult } from '@/types/scan';
import { formatDate } from '@/lib/utils';

type ImpactFilter = 'All' | 'critical' | 'serious' | 'moderate' | 'minor';

export default function ReportDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('All');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) fetchScan();
  }, [id]);

  const fetchScan = async () => {
    try {
      const res = await fetch(`/api/scan/${id}`);
      if (!res.ok) throw new Error('Scan not found');
      const data = await res.json();
      setScan(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const filteredViolations = scan?.violations?.filter(
    (v) => impactFilter === 'All' || v.impact === impactFilter
  ) || [];

  const impactBg = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'bg-severity-critical/10 text-severity-critical border-severity-critical/30';
      case 'serious':
        return 'bg-severity-serious/10 text-severity-serious border-severity-serious/30';
      case 'moderate':
        return 'bg-severity-moderate/10 text-severity-moderate border-severity-moderate/30';
      default:
        return 'bg-severity-minor/10 text-severity-minor border-severity-minor/30';
    }
  };

  const impactDot = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-severity-critical';
      case 'serious': return 'bg-severity-serious';
      case 'moderate': return 'bg-severity-moderate';
      default: return 'bg-severity-minor';
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const scoreBg = (score: number) => {
    if (score >= 75) return 'bg-green-500/10 border-green-500/30';
    if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Report Not Found</h2>
        <p className="text-text-secondary mb-4">
          {error || 'This scan report does not exist or you do not have access.'}
        </p>
        <Link
          href="/reports"
          className="text-accent hover:text-accent-hover"
        >
          ← Back to Reports
        </Link>
      </div>
    );
  }

  const score = scan.compliance_score || 0;
  const bigSix = scan.big_six || { contrast: 0, alt_text: 0, labels: 0, links: 0, buttons: 0, lang: 0 };
  const bigSixEntries = [
    { key: 'Low Contrast', value: bigSix.contrast || 0 },
    { key: 'Alt Text', value: bigSix.alt_text || 0 },
    { key: 'Labels', value: bigSix.labels || 0 },
    { key: 'Links', value: bigSix.links || 0 },
    { key: 'Buttons', value: bigSix.buttons || 0 },
    { key: 'Language', value: bigSix.lang || 0 },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold">Scan Report</h1>
          <p className="text-text-secondary text-sm mt-1">
            {scan.url} · {scan.completed_at ? formatDate(scan.completed_at) : 'N/A'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Download PDF */}
          <a
            href={`/api/reports/${id}/pdf`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Download PDF
          </a>
          {/* Export CSV */}
          <a
            href={`/api/reports/${id}/csv`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border hover:bg-surface-elevated text-text-primary rounded-lg text-sm font-medium transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Export CSV
          </a>
          {/* Share */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border hover:bg-surface-elevated text-text-secondary rounded-lg text-sm transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      {/* Score badge */}
      <div className={`inline-flex items-center gap-3 px-5 py-3 border rounded-xl ${scoreBg(score)}`}>
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <div>
          <span className="text-sm font-medium">/100</span>
          <p className="text-xs text-text-muted">Compliance Score</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Violations', value: scan.total_violations || 0, color: 'text-white' },
          { label: 'Critical', value: scan.critical_count || 0, color: 'text-severity-critical' },
          { label: 'Serious', value: scan.serious_count || 0, color: 'text-severity-serious' },
          { label: 'Moderate', value: scan.moderate_count || 0, color: 'text-severity-moderate' },
          { label: 'Minor', value: scan.minor_count || 0, color: 'text-severity-minor' },
          { label: 'Pages Scanned', value: scan.pages_scanned || 1, color: 'text-accent' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-border rounded-xl p-4 text-center"
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Big Six Section */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">Big Six Violations</h2>
        <p className="text-text-muted text-xs mb-4">
          These six issues cause 96% of all WCAG failures.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {bigSixEntries.map((item) => (
            <div
              key={item.key}
              className={`p-4 rounded-xl border ${
                item.value > 0
                  ? 'border-red-500/20 bg-red-500/5'
                  : 'border-green-500/20 bg-green-500/5'
              }`}
            >
              <p className="text-xs text-text-muted mb-1">{item.key}</p>
              <p className={`text-2xl font-bold ${item.value > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Violations list */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            Violations
            {impactFilter !== 'All' && (
              <span className="text-text-muted text-sm ml-2">
                ({filteredViolations.length} of {scan.violations?.length || 0})
              </span>
            )}
          </h2>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['All', 'critical', 'serious', 'moderate', 'minor'] as ImpactFilter[]).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setImpactFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    impactFilter === f
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              )
            )}
          </div>
        </div>

        {filteredViolations.length === 0 ? (
          <p className="text-text-muted text-sm py-8 text-center">
            No violations found {impactFilter !== 'All' ? `with ${impactFilter} impact` : ''}.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredViolations.map((v: any, idx: number) => {
              const isExpanded = expandedCards.has(idx);
              return (
                <div
                  key={idx}
                  className="border border-border rounded-xl overflow-hidden hover:border-accent/30 transition-colors"
                >
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="w-full text-left p-4 flex items-start gap-4"
                  >
                    <span
                      className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${impactDot(v.impact)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${impactBg(v.impact)}`}
                        >
                          {v.impact}
                        </span>
                        <span className="text-xs text-text-muted font-mono">
                          {v.rule_id || v.id}
                        </span>
                        {v.wcag_criterion && v.wcag_criterion !== 'N/A' && (
                          <span className="text-xs text-accent font-mono bg-accent/5 px-1.5 py-0.5 rounded">
                            WCAG {v.wcag_criterion}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-text-primary">
                        {v.rule_description || v.description || v.help}
                      </p>
                      {!isExpanded && (
                        <p className="text-xs text-text-muted mt-1 truncate">
                          {(v.fix_summary || v.help || '').slice(0, 100)}...
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-text-muted flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border space-y-3 pt-3 ml-8">
                      {/* Element HTML */}
                      {v.element_html && (
                        <div>
                          <p className="text-xs font-semibold text-text-muted mb-1">
                            Affected Element
                          </p>
                          <pre className="text-xs bg-surface-elevated p-3 rounded-lg overflow-x-auto font-mono text-text-secondary max-h-24 overflow-y-auto">
                            {v.element_html}
                          </pre>
                        </div>
                      )}

                      {/* How to fix */}
                      <div>
                        <p className="text-xs font-semibold text-text-muted mb-1">
                          How to Fix
                        </p>
                        <div className="text-sm text-text-secondary space-y-1">
                          {(v.fix_detail || v.fix_summary || v.help || '')
                            .split('\n')
                            .filter(Boolean)
                            .map((step: string, si: number) => (
                              <p key={si} className="flex gap-2">
                                <span className="text-accent flex-shrink-0">{si + 1}.</span>
                                <span>{step}</span>
                              </p>
                            ))}
                        </div>
                      </div>

                      {/* Help URL */}
                      {(v.help_url || v.helpUrl) && (
                        <a
                          href={v.help_url || v.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Documentation
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}