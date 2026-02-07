import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import type { Report } from '@/types/report'

interface Props {
  report: Report
}

export default function BenchmarkDetails({ report }: Props) {
  const { meta, benchmark, runs, artifacts } = report

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Benchmark Details</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Dataset</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">SHA256</span>
                <span className="text-slate-300 font-mono text-xs">{meta.dataset.hash_sha256.slice(0, 16)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Embeddings (N)</span>
                <span className="text-slate-300">{meta.dataset.N}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Axes (M)</span>
                <span className="text-slate-300">{meta.dataset.M}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dimensions (D)</span>
                <span className="text-slate-300">{meta.dataset.D}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Seed</span>
                <span className="text-slate-300">{meta.dataset.seed}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Configuration</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Warmup runs</span>
                <span className="text-slate-300">{benchmark.warmup}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Measured runs</span>
                <span className="text-slate-300">{benchmark.runs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Repeat count</span>
                <span className="text-slate-300">{benchmark.repeat}</span>
              </div>
              {benchmark.cpu_affinity !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">CPU affinity</span>
                  <span className="text-slate-300">Core {benchmark.cpu_affinity}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Stability Control</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Enabled</span>
                <span className="text-slate-300">
                  {benchmark.stability.enabled ? (
                    <CheckCircle className="w-4 h-4 text-green-400 inline" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 inline" />
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mode</span>
                <span className="text-slate-300">{benchmark.stability.mode}</span>
              </div>
              {benchmark.stability.waited_seconds !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Waited</span>
                  <span className="text-slate-300">{benchmark.stability.waited_seconds.toFixed(1)}s</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Implementations</h3>
            <div className="space-y-2">
              <div className="bg-slate-800 rounded p-3">
                <p className="text-sm text-slate-400 mb-1">Baseline</p>
                <p className="text-white font-medium">{runs.baseline.impl} ({runs.baseline.variant})</p>
                <p className="text-xs text-slate-500 mt-1">
                  {runs.baseline.samples.length} samples, {runs.baseline.status.filter(s => s === 'success').length} successful
                </p>
              </div>
              <div className="bg-slate-800 rounded p-3">
                <p className="text-sm text-slate-400 mb-1">Optimized</p>
                <p className="text-white font-medium">{runs.optimized.impl} ({runs.optimized.variant})</p>
                <p className="text-xs text-slate-500 mt-1">
                  {runs.optimized.samples.length} samples, {runs.optimized.status.filter(s => s === 'success').length} successful
                </p>
              </div>
            </div>
          </div>

          {benchmark.single_thread.env_vars && Object.keys(benchmark.single_thread.env_vars).length > 0 && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-white font-semibold mb-3">Single-Thread Enforcement</h3>
              <div className="space-y-1">
                {Object.entries(benchmark.single_thread.env_vars).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm bg-slate-800 rounded px-3 py-2">
                    <span className="text-slate-400 font-mono">{key}</span>
                    <span className="text-slate-300 font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {artifacts && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-white font-semibold mb-3">Artifacts</h3>
              <div className="space-y-2 text-sm">
                {artifacts.results_csv && (
                  <div className="text-slate-300">
                    <span className="text-slate-400">Results CSV:</span> {artifacts.results_csv}
                  </div>
                )}
                {artifacts.summary_json && (
                  <div className="text-slate-300">
                    <span className="text-slate-400">Summary JSON:</span> {artifacts.summary_json}
                  </div>
                )}
                {artifacts.prometheus_url && (
                  <a
                    href={artifacts.prometheus_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-400 hover:text-primary-300"
                  >
                    Prometheus <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {artifacts.grafana_url && (
                  <a
                    href={artifacts.grafana_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-400 hover:text-primary-300"
                  >
                    Grafana Dashboard <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-3">Metadata</h3>
            <div className="space-y-2 text-sm">
              <div className="text-slate-300">
                <span className="text-slate-400">Version:</span> {meta.app_version}
              </div>
              {meta.git_commit && (
                <div className="text-slate-300">
                  <span className="text-slate-400">Commit:</span> <span className="font-mono text-xs">{meta.git_commit.slice(0, 8)}</span>
                </div>
              )}
              <div className="text-slate-300">
                <span className="text-slate-400">Generated:</span> {new Date(meta.generated_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
        <p className="text-slate-400 text-sm">
          <strong className="text-slate-300">Command:</strong>
        </p>
        <code className="text-xs text-slate-300 font-mono block mt-2 bg-slate-800 p-3 rounded overflow-x-auto">
          {benchmark.command_line}
        </code>
      </div>
    </section>
  )
}
