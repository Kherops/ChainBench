import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Report, ImpactInputs } from '@/types/report'
import { calculateImpact } from '@/utils/calculations'
import ExecutiveSummary from './ExecutiveSummary'
import BeforeAfterChart from './BeforeAfterChart'
import ImpactCards from './ImpactCards'
import EvidenceSection from './EvidenceSection'
import BenchmarkDetails from './BenchmarkDetails'
import { ResourceProfilesSection } from './ResourceProfileChart'

interface Props {
  report: Report
  onReset: () => void
}

export default function ReportViewer({ report, onReset }: Props) {
  const [impactInputs, setImpactInputs] = useState<ImpactInputs>(report.impact.inputs)
  
  const recalculatedImpact = calculateImpact(report.summary.delta_ms, impactInputs)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onReset}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">ChainBench Report</h1>
              <p className="text-sm text-slate-400">
                {report.meta.report_id} • {new Date(report.meta.generated_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">{report.meta.machine.hostname}</p>
            <p className="text-xs text-slate-500">{report.meta.machine.os} • {report.meta.machine.kernel}</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <ExecutiveSummary report={report} />
          <BeforeAfterChart report={report} />
          {report.resource_profiles && (
            <ResourceProfilesSection profiles={report.resource_profiles} />
          )}
          <ImpactCards
            report={report}
            impactInputs={impactInputs}
            onImpactInputsChange={setImpactInputs}
          />
          <EvidenceSection report={report} />
          <BenchmarkDetails report={report} />
        </div>
      </main>
    </div>
  )
}
