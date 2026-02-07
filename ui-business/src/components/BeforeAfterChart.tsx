import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { Report } from '@/types/report'

interface Props {
  report: Report
}

export default function BeforeAfterChart({ report }: Props) {
  const { evidence } = report

  if (!evidence.available) {
    return (
      <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Before/After Analysis</h2>
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            eBPF evidence not available. Run benchmarks with eBPF agent to see detailed analysis.
          </p>
        </div>
      </section>
    )
  }

  const normalize = (baseline: number, optimized: number) => {
    if (baseline === 0) return { baseline: 100, optimized: 100 }
    return {
      baseline: 100,
      optimized: (optimized / baseline) * 100
    }
  }

  const axes = []

  if (evidence.runqlat?.p95_baseline_us && evidence.runqlat?.p95_optimized_us) {
    const normalized = normalize(evidence.runqlat.p95_baseline_us, evidence.runqlat.p95_optimized_us)
    axes.push({
      axis: 'CPU Wait\n(Scheduler)',
      baseline: normalized.baseline,
      optimized: normalized.optimized,
      tooltip: 'Time spent waiting in CPU runqueue. Lower is better. Measures scheduler latency.',
    })
  }

  if (evidence.offcpu?.baseline_total_ms && evidence.offcpu?.optimized_total_ms) {
    const normalized = normalize(evidence.offcpu.baseline_total_ms, evidence.offcpu.optimized_total_ms)
    axes.push({
      axis: 'Blocking/\nOff-CPU',
      baseline: normalized.baseline,
      optimized: normalized.optimized,
      tooltip: 'Time blocked on locks, futex, I/O sync. Lower is better. Measures thread blocking.',
    })
  }

  if (evidence.biolatency?.p95_baseline_us && evidence.biolatency?.p95_optimized_us) {
    const normalized = normalize(evidence.biolatency.p95_baseline_us, evidence.biolatency.p95_optimized_us)
    axes.push({
      axis: 'I/O Latency\n(Disk/FS)',
      baseline: normalized.baseline,
      optimized: normalized.optimized,
      tooltip: 'Disk and filesystem I/O latency. Lower is better. Measures storage bottlenecks.',
    })
  }

  if (evidence.exec?.baseline_exec_count && evidence.exec?.optimized_exec_count) {
    const normalized = normalize(evidence.exec.baseline_exec_count, evidence.exec.optimized_exec_count)
    axes.push({
      axis: 'Execution\nOverhead',
      baseline: normalized.baseline,
      optimized: normalized.optimized,
      tooltip: 'Process creation and syscall volume. Lower is better. Measures orchestration overhead.',
    })
  }

  if (evidence.syscall_counts?.baseline && evidence.syscall_counts?.optimized) {
    const baselineTotal = Object.values(evidence.syscall_counts.baseline).reduce((a, b) => (a || 0) + (b || 0), 0)
    const optimizedTotal = Object.values(evidence.syscall_counts.optimized).reduce((a, b) => (a || 0) + (b || 0), 0)
    if (baselineTotal > 0) {
      const normalized = normalize(baselineTotal, optimizedTotal)
      axes.push({
        axis: 'Syscall\nVolume',
        baseline: normalized.baseline,
        optimized: normalized.optimized,
        tooltip: 'Total syscall count (futex, fsync, openat, read, write). Lower is better.',
      })
    }
  }

  if (axes.length === 0) {
    return (
      <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Before/After Analysis</h2>
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            Insufficient eBPF metrics for visualization. Check agent configuration.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Before/After Analysis</h2>
      <p className="text-slate-400 text-sm mb-6">
        Normalized view of performance bottlenecks. Baseline = 100, lower optimized values indicate improvement.
      </p>
      
      <div className="bg-slate-900/50 rounded-lg p-6">
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={axes}>
            <PolarGrid stroke="#475569" />
            <PolarAngleAxis 
              dataKey="axis" 
              tick={{ fill: '#cbd5e1', fontSize: 12 }}
              stroke="#475569"
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 120]} 
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              stroke="#475569"
            />
            <Radar
              name="Baseline"
              dataKey="baseline"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name="Optimized"
              dataKey="optimized"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#e2e8f0'
              }}
              formatter={(value: number) => `${value.toFixed(1)}`}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {axes.map((axis) => (
          <div key={axis.axis} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <p className="text-white font-semibold mb-1">{axis.axis.replace('\n', ' ')}</p>
            <p className="text-slate-400 text-xs mb-2">{axis.tooltip}</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-red-400">Base: {axis.baseline.toFixed(0)}</span>
              <span className="text-green-400">Opt: {axis.optimized.toFixed(0)}</span>
              <span className={axis.optimized < axis.baseline ? 'text-green-400' : 'text-red-400'}>
                {axis.optimized < axis.baseline ? '↓' : '↑'} {Math.abs(axis.baseline - axis.optimized).toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
