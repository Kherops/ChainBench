import { z } from 'zod'

const MachineSchema = z.object({
  hostname: z.string(),
  os: z.string(),
  kernel: z.string(),
  cpu_model: z.string().optional(),
  ram_total_gb: z.number().optional(),
})

const DatasetSchema = z.object({
  hash_sha256: z.string(),
  N: z.number(),
  M: z.number(),
  D: z.number(),
  seed: z.number(),
})

const MetaSchema = z.object({
  report_id: z.string(),
  generated_at: z.string(),
  app_version: z.string(),
  git_commit: z.string().optional(),
  machine: MachineSchema,
  dataset: DatasetSchema,
})

const StabilitySchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['wait', 'skip', 'fail']),
  waited_seconds: z.number().optional(),
})

const SingleThreadSchema = z.object({
  env_vars: z.record(z.string()).optional(),
})

const ImplSchema = z.object({
  name: z.string(),
  variant: z.string(),
})

const BenchmarkSchema = z.object({
  command_line: z.string(),
  warmup: z.number(),
  runs: z.number(),
  repeat: z.number(),
  stability: StabilitySchema,
  single_thread: SingleThreadSchema,
  cpu_affinity: z.number().optional(),
  impls: z.array(ImplSchema),
})

const RunDataSchema = z.object({
  impl: z.string(),
  variant: z.string(),
  samples: z.array(z.number()),
  status: z.array(z.enum(['success', 'fail'])),
  errors: z.array(z.string()).optional(),
})

const RunsSchema = z.object({
  baseline: RunDataSchema,
  optimized: RunDataSchema,
})

const StatsSchema = z.object({
  median: z.number(),
  mean: z.number(),
  std: z.number(),
  cv_pct: z.number(),
  p10: z.number(),
  p90: z.number(),
})

const SummarySchema = z.object({
  baseline_stats: StatsSchema,
  optimized_stats: StatsSchema,
  delta_ms: z.number(),
  gain_pct: z.number(),
  verdict: z.enum(['conclusive', 'inconclusive']),
  notes: z.string().optional(),
})

const HistogramBucketSchema = z.object({
  bucket_us: z.number(),
  count: z.number(),
})

const RunqlatSchema = z.object({
  baseline_hist: z.array(HistogramBucketSchema).optional(),
  optimized_hist: z.array(HistogramBucketSchema).optional(),
  p95_baseline_us: z.number().optional(),
  p95_optimized_us: z.number().optional(),
})

const BiolatencySchema = z.object({
  baseline_hist: z.array(HistogramBucketSchema).optional(),
  optimized_hist: z.array(HistogramBucketSchema).optional(),
  p95_baseline_us: z.number().optional(),
  p95_optimized_us: z.number().optional(),
})

const ReasonSchema = z.object({
  reason: z.string(),
  ms: z.number(),
})

const OffcpuSchema = z.object({
  baseline_total_ms: z.number().optional(),
  optimized_total_ms: z.number().optional(),
  baseline_top_reasons: z.array(ReasonSchema).optional(),
  optimized_top_reasons: z.array(ReasonSchema).optional(),
})

const CommandCountSchema = z.object({
  command: z.string(),
  count: z.number(),
})

const ExecSchema = z.object({
  baseline_exec_count: z.number().optional(),
  optimized_exec_count: z.number().optional(),
  baseline_top_commands: z.array(CommandCountSchema).optional(),
  optimized_top_commands: z.array(CommandCountSchema).optional(),
})

const SyscallDataSchema = z.object({
  futex: z.number().optional(),
  fsync: z.number().optional(),
  openat: z.number().optional(),
  read: z.number().optional(),
  write: z.number().optional(),
})

const SyscallCountsSchema = z.object({
  baseline: SyscallDataSchema.optional(),
  optimized: SyscallDataSchema.optional(),
})

const EvidenceSchema = z.object({
  available: z.boolean(),
  runqlat: RunqlatSchema.optional(),
  biolatency: BiolatencySchema.optional(),
  offcpu: OffcpuSchema.optional(),
  exec: ExecSchema.optional(),
  syscall_counts: SyscallCountsSchema.optional(),
})

const ImpactInputsSchema = z.object({
  executions_per_day: z.number(),
  days_per_year: z.number(),
  cost_model: z.enum(['infra', 'human']),
  cost_per_hour_eur: z.number(),
  electricity_kwh_per_hour: z.number(),
  co2_kg_per_kwh: z.number(),
})

const ImpactOutputsSchema = z.object({
  time_saved_hours_per_year: z.number(),
  cost_saved_eur_per_year: z.number(),
  electricity_saved_kwh_per_year: z.number(),
  co2_avoided_kg_per_year: z.number(),
})

const ImpactSchema = z.object({
  inputs: ImpactInputsSchema,
  outputs: ImpactOutputsSchema,
})

const ArtifactsSchema = z.object({
  results_csv: z.string().optional(),
  summary_json: z.string().optional(),
  logs: z.array(z.string()).optional(),
  prometheus_url: z.string().optional(),
  grafana_url: z.string().optional(),
})

export const ReportSchema = z.object({
  schema_version: z.string(),
  meta: MetaSchema,
  benchmark: BenchmarkSchema,
  runs: RunsSchema,
  summary: SummarySchema,
  evidence: EvidenceSchema,
  impact: ImpactSchema,
  artifacts: ArtifactsSchema.optional(),
})

export type Report = z.infer<typeof ReportSchema>
export type ImpactInputs = z.infer<typeof ImpactInputsSchema>
export type ImpactOutputs = z.infer<typeof ImpactOutputsSchema>
export type Evidence = z.infer<typeof EvidenceSchema>
export type Stats = z.infer<typeof StatsSchema>
