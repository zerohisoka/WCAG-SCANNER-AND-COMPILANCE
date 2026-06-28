import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'

export default async function ReportDetailPage({
  params
}: {
  params: { id: string }
}) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch report
  const { data: report, error } = await supabase
    .from('reports')
    .select(`*, scans(*)`)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !report) notFound()

  const scan = report.scans as any

  // Fetch violations for this scan
  const { data: violations } = await supabase
    .from('violations')
    .select('*')
    .eq('scan_id', report.scan_id)
    .order('impact', { ascending: false })

  const score = scan?.compliance_score ?? 0
  const scoreColor = score >= 90 ? '#22D3A0'
    : score >= 75 ? '#22c55e'
    : score >= 50 ? '#F59E0B'
    : '#EF4444'

  const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 }
  const sortedViolations = (violations || []).sort((a, b) => 
    (impactOrder[a.impact] ?? 4) - (impactOrder[b.impact] ?? 4)
  )

  const impactColors = {
    critical: '#FF3B3B',
    serious: '#FF7A00', 
    moderate: '#FFB800',
    minor: '#64B5F6'
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <a href="/dashboard/reports" 
          className="text-gray-400 hover:text-white text-sm mb-4 inline-block">
          ← Back to Reports
        </a>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white break-all">
              {scan?.url}
            </h1>
            <p className="text-gray-400 mt-1">
              Scanned on {new Date(report.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <div className="flex gap-3 ml-4">
            <a href={`/api/reports/${params.id}/pdf`}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 
                text-white px-4 py-2 rounded-lg text-sm transition-colors">
              Download PDF
            </a>
            <a href={`/api/reports/${params.id}/csv`}
              className="flex items-center gap-2 bg-[#1A1A24] hover:bg-[#2A2A3A] 
                border border-[#2A2A3A] text-white px-4 py-2 rounded-lg 
                text-sm transition-colors">
              Export CSV
            </a>
          </div>
        </div>
      </div>

      {/* Score + Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-4 
          col-span-2 md:col-span-1">
          <p className="text-gray-400 text-sm">Compliance Score</p>
          <p className="text-4xl font-bold mt-1" style={{ color: scoreColor }}>
            {score}/100
          </p>
        </div>
        <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-4">
          <p className="text-gray-400 text-sm">Total Issues</p>
          <p className="text-2xl font-bold text-white mt-1">
            {scan?.total_violations ?? 0}
          </p>
        </div>
        <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-4">
          <p className="text-gray-400 text-sm">Critical</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#FF3B3B' }}>
            {scan?.critical_count ?? 0}
          </p>
        </div>
        <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-4">
          <p className="text-gray-400 text-sm">Serious</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#FF7A00' }}>
            {scan?.serious_count ?? 0}
          </p>
        </div>
      </div>

      {/* Big Six */}
      {scan?.big_six && (
        <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Big Six Violations
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(scan.big_six).map(([key, count]: [string, any]) => (
              <div key={key} className="flex items-center justify-between 
                bg-[#0A0A0F] rounded-lg p-3">
                <span className="text-gray-400 text-sm capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className={`font-bold ${count > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violations List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          All Violations ({sortedViolations.length})
        </h2>
        {sortedViolations.length === 0 ? (
          <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-8 
            text-center">
            <p className="text-green-400 text-lg font-medium">
              No violations found!
            </p>
            <p className="text-gray-400 mt-2">
              This site passed automated WCAG checks.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedViolations.map((violation) => {
              const color = impactColors[violation.impact] || '#64B5F6'
              return (
                <div key={violation.id} 
                  className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-1 rounded text-xs font-bold uppercase shrink-0"
                      style={{ 
                        backgroundColor: color + '20', 
                        color 
                      }}>
                      {violation.impact}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">
                        {violation.rule_description || violation.description}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        Rule: {violation.rule_id || violation.id}
                      </p>
                      {violation.element_html && (
                        <pre className="bg-[#0A0A0F] rounded-lg p-3 mt-3 
                          text-xs text-gray-300 overflow-x-auto">
                          <code>{violation.element_html}</code>
                        </pre>
                      )}
                      {violation.fix_summary && (
                        <div className="mt-3 bg-purple-900/20 border 
                          border-purple-500/20 rounded-lg p-3">
                          <p className="text-purple-300 text-sm font-medium">
                            How to fix:
                          </p>
                          <p className="text-gray-300 text-sm mt-1">
                            {violation.fix_summary}
                          </p>
                        </div>
                      )}
                      {(violation.help_url || violation.helpUrl) && (
                        <a href={violation.help_url || violation.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 
                            text-xs mt-2 inline-block">
                          Learn more →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}