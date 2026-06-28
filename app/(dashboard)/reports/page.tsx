'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, AlertTriangle } from 'lucide-react';
import ReportCard from '@/components/reports/ReportCard';
import { useUser } from '@/hooks/useUser';

export default function ReportsPage() {
  const { user } = useUser();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchReports();
  }, [user]);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        console.log('Reports fetched:', data.reports?.length, data.error);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-text-secondary text-sm mt-1">Your scan history and compliance reports.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-surface-elevated" />
                <div className="flex-1">
                  <div className="h-4 bg-surface-elevated rounded w-48 mb-2" />
                  <div className="h-3 bg-surface-elevated rounded w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reports.length > 0 ? (
        <div className="grid gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <AlertTriangle className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="font-semibold mb-1">No reports yet</h3>
          <p className="text-text-secondary text-sm mb-4">
            Run a scan to generate your first compliance report.
          </p>
          <Link
            href="/scanner"
            className="inline-block px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm"
          >
            Run First Scan
          </Link>
        </div>
      )}
    </div>
  );
}