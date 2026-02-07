# ChainBench Usage Guide

Complete end-to-end workflow for measuring, analyzing, and valorizing performance gains.

## Quick Start (5 minutes)

```bash
# 1. Start observability stack
docker-compose up -d

# 2. Start eBPF agent (optional, requires sudo on Linux)
sudo ./agent-ebpf/bin/chainbench-agent --port 9090 &

# 3. View example report in UI
cd ui-business
npm run dev
# Open http://localhost:5173 and drag examples/report-example.json

# 4. View Grafana dashboard
# Open http://localhost:3000 (admin/admin)
# Navigate to ChainBench Performance Dashboard
```

## Complete Workflow

### Step 1: Generate Dataset

```bash
python3 data/generate_data.py \
  --N 2000 \
  --M 15 \
  --D 96 \
  --seed 42 \
  --force
```

**Parameters**:
- `N`: Number of embeddings
- `M`: Number of axes
- `D`: Dimensions
- `seed`: Random seed (for reproducibility)
- `--force`: Overwrite existing dataset

**Output**:
- `data/embeddings.f64` - Embedding vectors
- `data/axes.f64` - Axis vectors
- `data/metadata.json` - Dataset metadata
- `data/dataset.lock` - Lock file (prevents cross-dataset comparison)

### Step 2: Start eBPF Agent (Optional)

```bash
# Linux with eBPF
sudo ./agent-ebpf/bin/chainbench-agent --port 9090

# macOS or without eBPF (fallback mode)
./agent-ebpf/bin/chainbench-agent --port 9090
```

**Endpoints**:
- `POST /start` - Start evidence collection
- `POST /stop` - Stop and retrieve evidence
- `GET /status` - Check agent status
- `POST /report` - Report metrics to Prometheus
- `GET /metrics` - Prometheus metrics

### Step 3: Run Benchmarks

```bash
python3 runner/run_all.py \
  --metadata data/metadata.json \
  --warmup 5 \
  --runs 30 \
  --repeat 50 \
  --stability-enable \
  --stability-mode wait \
  --enforce-single-thread \
  --cpu-affinity 2 \
  --impls python-naive,python-numpy \
  --ebpf-agent http://localhost:9090
```

**Key Parameters**:
- `--warmup`: Warmup runs (discarded)
- `--runs`: Measurement runs per repeat
- `--repeat`: Number of repetitions
- `--stability-enable`: Wait for system stability
- `--stability-mode`: `wait` | `skip` | `fail`
- `--enforce-single-thread`: Force single-threaded execution
- `--cpu-affinity`: Pin to specific CPU core
- `--impls`: Comma-separated implementation list
- `--ebpf-agent`: eBPF agent URL (optional)

**Output**:
- `runner/results.csv` - Raw results
- `runner/summary.json` - Statistical summary
- `runner/dataset.lock` - Dataset verification

### Step 4: Build Report

```bash
python3 report-builder/build_report.py \
  --runner-summary runner/summary.json \
  --ebpf-evidence agent-ebpf/evidence.json \
  --metadata data/metadata.json \
  --output report.json \
  --command-line "$(history | tail -1)" \
  --baseline-impl python \
  --baseline-variant naive \
  --optimized-impl python \
  --optimized-variant numpy
```

**Output**: `report.json` - Single source of truth

### Step 5: View in UI

```bash
cd ui-business
npm run dev
```

1. Open http://localhost:5173
2. Drag & drop `report.json`
3. Explore:
   - **Executive Summary**: Gain%, verdict, stats
   - **Before/After Chart**: Radar chart of bottlenecks
   - **Impact Cards**: Time, €, kWh, CO₂ saved
   - **Evidence**: eBPF kernel-level insights
   - **Details**: Full benchmark configuration

### Step 6: Monitor in Grafana

1. Open http://localhost:3000 (admin/admin)
2. Navigate to **Dashboards** → **ChainBench Performance Dashboard**
3. View:
   - Gain% over time
   - Baseline vs Optimized duration
   - CPU scheduler latency (p95)
   - I/O latency (p95)
   - Off-CPU time
   - Syscall rates

## Advanced Usage

### Custom Impact Calculations

Edit impact assumptions in UI:
1. Load report
2. Click **Edit Assumptions**
3. Modify:
   - Executions per day
   - Days per year
   - Cost model (infra/human)
   - Cost per hour (€)
   - Electricity (kWh/hour)
   - CO₂ intensity (kg/kWh)
4. Click **Save**
5. Outputs recalculate live

### Comparing Multiple Reports

```bash
# Generate multiple reports
./run_benchmark.sh --impl rust-naive > report-rust.json
./run_benchmark.sh --impl go-naive > report-go.json

# Load in UI and compare
# (Future feature: side-by-side comparison)
```

### Prometheus Queries

```promql
# Average gain over last hour
avg_over_time(chainbench_gain_percent[1h])

# p95 scheduler latency
histogram_quantile(0.95, rate(chainbench_runqlat_microseconds_bucket[5m]))

# Failure rate
rate(chainbench_runs_total{result="fail"}[5m])
```

### Grafana Alerts

Alerts are pre-configured in `prometheus/alerts.yml`:
- **PerformanceRegression**: Gain < 5%
- **PerformanceDegradation**: Gain < 0%
- **HighSchedulerLatency**: p95 > 100μs
- **HighIOLatency**: p95 > 5000μs
- **BenchmarkFailures**: Failure rate > 10%

Configure notifications in Grafana → Alerting → Contact Points.

## Best Practices

### Reproducibility

1. **Always use same dataset**: Check `dataset.lock` matches
2. **Document environment**: OS, kernel, CPU, RAM
3. **Control variables**: Same machine, same time of day
4. **Version control**: Commit hash in report
5. **Stability checks**: Enable `--stability-enable`

### Measurement Quality

1. **Sufficient samples**: 30+ runs recommended
2. **Warmup**: 5+ warmup runs
3. **CPU affinity**: Pin to single core
4. **Single-threaded**: Enforce with env vars
5. **System idle**: Close other applications

### Interpretation

1. **Check verdict**: Only trust "conclusive" results
2. **Low CV%**: < 5% is excellent, < 10% is good
3. **Distribution overlap**: Check p10/p90 ranges
4. **eBPF evidence**: Verify kernel-level improvements
5. **Machine-constant**: Never compare across machines

### Reporting

1. **Include context**: Hardware, OS, dataset
2. **Show raw data**: Preserve samples, not just stats
3. **Document assumptions**: Impact calculation inputs
4. **Track over time**: Use Prometheus/Grafana
5. **Audit trail**: Git commit, command line, timestamps

## Common Workflows

### Workflow 1: Language Comparison

```bash
# Same algorithm, different languages
python3 runner/run_all.py --impls c-naive,cpp-naive,rust-naive,go-naive,python-naive

# Compare in UI
# Note: Compare ratios, not absolute times
```

### Workflow 2: Optimization Validation

```bash
# Before optimization
python3 runner/run_all.py --impls python-naive
mv report.json report-before.json

# After optimization
python3 runner/run_all.py --impls python-optimized
mv report.json report-after.json

# Compare gain%
```

### Workflow 3: Continuous Monitoring

```bash
# Run in CI/CD
./run_benchmark.sh --impl production

# Report to Prometheus
curl -X POST http://localhost:9090/report -d @metrics.json

# Alert on regression
# (Grafana alerts configured automatically)
```

### Workflow 4: A/B Testing

```bash
# Test two variants
python3 runner/run_all.py --impls variant-a,variant-b

# Statistical comparison
python3 report-builder/build_report.py \
  --baseline-variant variant-a \
  --optimized-variant variant-b
```

## Troubleshooting

### High CV% (Inconclusive Results)

**Causes**:
- System not stable (background processes)
- Insufficient warmup
- Thermal throttling
- Memory pressure

**Solutions**:
```bash
# Wait for stability
--stability-mode wait --stability-timeout 300

# More warmup
--warmup 10

# Check system load
top, htop, vmstat
```

### eBPF Evidence Missing

**Causes**:
- eBPF agent not running
- Insufficient permissions
- eBPF tools not installed

**Solutions**:
```bash
# Check agent status
curl http://localhost:9090/status

# Run with sudo
sudo ./agent-ebpf/bin/chainbench-agent

# Install BCC tools
sudo apt-get install bpfcc-tools
```

### Prometheus Not Scraping

**Causes**:
- Agent not exposing /metrics
- Firewall blocking port
- Wrong target in prometheus.yml

**Solutions**:
```bash
# Check metrics endpoint
curl http://localhost:9090/metrics

# Check Prometheus targets
curl http://localhost:9091/api/v1/targets

# Verify docker network
docker network inspect chainbench_chainbench
```

## Next Steps

- Read [Mental Model](mental-model.md) to understand ChainBench philosophy
- Review [Report Schema](report-schema.md) for JSON structure
- Explore [eBPF Evidence](ebpf-evidence.md) for kernel insights
- Check example reports in `examples/`
