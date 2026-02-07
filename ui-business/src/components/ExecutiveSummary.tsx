import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import type { Report } from '@/types/report'
import { formatNumber } from '@/utils/calculations'

interface Props {
  report: Report
}

export default function ExecutiveSummary({ report }: Props) {
  const { summary } = report
  const isPositiveGain = summary.gain_pct > 0
  const isConclusive = summary.verdict === 'conclusive'

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Executive Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Performance Gain</p>
          <div className="flex items-center gap-2">
            {isPositiveGain ? (
              <TrendingUp className="w-6 h-6 text-green-400" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-400" />
            )}
            <span className={`text-3xl font-bold ${isPositiveGain ? 'text-green-400' : 'text-red-400'}`}>
              {isPositiveGain ? '+' : ''}{formatNumber(summary.gain_pct, 1)}%
            </span>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Time Saved</p>
          <p className="text-3xl font-bold text-white">{formatNumber(summary.delta_ms, 0)} ms</p>
          <p className="text-xs text-slate-500 mt-1">per execution</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Baseline</p>
          <p className="text-2xl font-bold text-slate-300">{formatNumber(summary.baseline_stats.median, 0)} ms</p>
          <p className="text-xs text-slate-500 mt-1">median (CV: {formatNumber(summary.baseline_stats.cv_pct, 1)}%)</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Optimized</p>
          <p className="text-2xl font-bold text-slate-300">{formatNumber(summary.optimized_stats.median, 0)} ms</p>
          <p className="text-xs text-slate-500 mt-1">median (CV: {formatNumber(summary.optimized_stats.cv_pct, 1)}%)</p>
        </div>
      </div>

      <div className={`mt-4 p-4 rounded-lg border ${
        isConclusive 
          ? 'bg-green-900/20 border-green-700' 
          : 'bg-yellow-900/20 border-yellow-700'
      }`}>
        <div className="flex items-start gap-3">
          <AlertCircle className={`w-5 h-5 mt-0.5 ${isConclusive ? 'text-green-400' : 'text-yellow-400'}`} />
          <div>
            <p className={`font-semibold ${isConclusive ? 'text-green-300' : 'text-yellow-300'}`}>
              Verdict: {isConclusive ? 'Conclusive' : 'Inconclusive'}
            </p>
            <p className="text-sm text-slate-300 mt-1">
              {isConclusive 
                ? 'Low coefficient of variation and minimal distribution overlap indicate reliable performance difference.'
                : 'High variability or distribution overlap suggests results may not be statistically robust. Consider more runs or improved stability.'}
            </p>
            {summary.notes && (
              <p className="text-sm text-slate-400 mt-2 italic">{summary.notes}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <p className="text-blue-300 text-sm font-medium mb-2">Machine-Agnostic Measurement</p>
        <p className="text-slate-300 text-sm">
          Gain measured at <strong>environment constant</strong> (same machine). 
          Hardware changes absolute times, not necessarily gain direction. 
          Track ratio stability over time via Prometheus/Grafana.
        </p>
      </div>
    </section>
  )
}
