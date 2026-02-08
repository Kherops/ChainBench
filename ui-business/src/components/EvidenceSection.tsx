import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Report } from '@/types/report'

interface Props {
  report: Report
}

export default function EvidenceSection({ report }: Props) {
  const { evidence } = report
  if (!evidence.available) {
    return (
      <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Technical Evidence</h2>
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            eBPF evidence not available. Run with eBPF agent for kernel-level insights.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Technical Evidence (eBPF)</h2>
      <p className="text-slate-400 text-sm mb-6">
        Kernel-level proof of where time is spent and why performance differs
      </p>

      <div className="space-y-6">
        {evidence.runqlat && (
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">CPU Wait (Scheduler Latency)</h3>
            <p className="text-slate-400 text-sm mb-4">
              Time spent waiting in CPU runqueue. High values indicate CPU contention or scheduler issues.
            </p>
            {evidence.runqlat.p95_baseline_us && evidence.runqlat.p95_optimized_us && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Baseline p95</p>
                  <p className="text-2xl font-bold text-red-400">{evidence.runqlat.p95_baseline_us.toFixed(0)} μs</p>
                </div>
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Optimized p95</p>
                  <p className="text-2xl font-bold text-green-400">{evidence.runqlat.p95_optimized_us.toFixed(0)} μs</p>
                </div>
              </div>
            )}
            {evidence.runqlat.baseline_hist && evidence.runqlat.optimized_hist && (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={evidence.runqlat.baseline_hist.map((b, i) => ({
                  bucket: `${b.bucket_us}μs`,
                  baseline: b.count,
                  optimized: evidence.runqlat.optimized_hist?.[i]?.count || 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="bucket" tick={{ fill: '#cbd5e1', fontSize: 11 }} stroke="#475569" />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} stroke="#475569" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="baseline" fill="#ef4444" name="Baseline" />
                  <Bar dataKey="optimized" fill="#10b981" name="Optimized" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {evidence.biolatency && (
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">I/O Latency (Disk/Filesystem)</h3>
            <p className="text-slate-400 text-sm mb-4">
              Block I/O latency distribution. High values indicate storage bottlenecks.
            </p>
            {evidence.biolatency.p95_baseline_us && evidence.biolatency.p95_optimized_us && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Baseline p95</p>
                  <p className="text-2xl font-bold text-red-400">{evidence.biolatency.p95_baseline_us.toFixed(0)} μs</p>
                </div>
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Optimized p95</p>
                  <p className="text-2xl font-bold text-green-400">{evidence.biolatency.p95_optimized_us.toFixed(0)} μs</p>
                </div>
              </div>
            )}
          </div>
        )}

        {evidence.offcpu && (
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Blocking / Off-CPU Time</h3>
            <p className="text-slate-400 text-sm mb-4">
              Time spent blocked (locks, futex, I/O sync). Lower is better.
            </p>
            {evidence.offcpu.baseline_total_ms && evidence.offcpu.optimized_total_ms && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Baseline total</p>
                  <p className="text-2xl font-bold text-red-400">{evidence.offcpu.baseline_total_ms.toFixed(0)} ms</p>
                </div>
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Optimized total</p>
                  <p className="text-2xl font-bold text-green-400">{evidence.offcpu.optimized_total_ms.toFixed(0)} ms</p>
                </div>
              </div>
            )}
            {evidence.offcpu.baseline_top_reasons && evidence.offcpu.baseline_top_reasons.length > 0 && (
              <div>
                <p className="text-slate-300 font-medium mb-2">Top blocking reasons (baseline):</p>
                <div className="space-y-1">
                  {evidence.offcpu.baseline_top_reasons.slice(0, 5).map((r, i) => (
                    <div key={i} className="flex justify-between text-sm bg-slate-800 rounded px-3 py-2">
                      <span className="text-slate-300">{r.reason}</span>
                      <span className="text-red-400 font-mono">{r.ms.toFixed(1)} ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {evidence.exec && (
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Execution Overhead</h3>
            <p className="text-slate-400 text-sm mb-4">
              Process creation count. High values indicate excessive fork/exec overhead.
            </p>
            {evidence.exec.baseline_exec_count !== undefined && evidence.exec.optimized_exec_count !== undefined && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Baseline execs</p>
                  <p className="text-2xl font-bold text-red-400">{evidence.exec.baseline_exec_count}</p>
                </div>
                <div className="bg-slate-800 rounded p-4">
                  <p className="text-slate-400 text-sm">Optimized execs</p>
                  <p className="text-2xl font-bold text-green-400">{evidence.exec.optimized_exec_count}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {evidence.syscall_counts && (
          <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Syscall Counts</h3>
            <p className="text-slate-400 text-sm mb-4">
              Key syscalls (futex, fsync, openat, read, write). Lower counts often indicate better efficiency.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-300 font-medium mb-2">Baseline</p>
                <div className="space-y-1">
                  {Object.entries(evidence.syscall_counts.baseline || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm bg-slate-800 rounded px-3 py-2">
                      <span className="text-slate-300">{key}</span>
                      <span className="text-red-400 font-mono">{value?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-slate-300 font-medium mb-2">Optimized</p>
                <div className="space-y-1">
                  {Object.entries(evidence.syscall_counts.optimized || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm bg-slate-800 rounded px-3 py-2">
                      <span className="text-slate-300">{key}</span>
                      <span className="text-green-400 font-mono">{value?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
