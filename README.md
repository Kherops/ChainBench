# ChainBench

**Performance measurement, analysis, and business impact platform**

ChainBench measures, explains, and valorizes structural performance gains in software chains through:

- Multi-language reproducible benchmarks
- eBPF kernel-level evidence (latency, blocking, I/O)
- Prometheus metrics + Grafana dashboards for historical tracking
- Business UI (gain% + € + energy + CO₂) readable by non-experts, auditable by experts
- Versioned `report.json` as single source of truth

## Architecture

ChainBench consists of 4 distinct layers:

1. **Runner** - Executes benchmarks with reproducibility guarantees (stability, mono-thread, CPU affinity)
2. **eBPF Agent** - Collects kernel-level evidence and exposes Prometheus `/metrics`
3. **Report Builder** - Aggregates runner + eBPF data into validated `report.json`
4. **Business UI** - React+TS interface for decision-makers and technical audits

## Quick Start

### 1. Generate Dataset

```bash
python3 data/generate_data.py --N 2000 --M 15 --D 96 --seed 42 --force
```

### 2. Run Benchmarks with eBPF Evidence

```bash
# Start eBPF agent (requires sudo/CAP_BPF)
sudo ./agent-ebpf/bin/chainbench-agent --port 9090

# Run benchmarks
python3 runner/run_all.py \
  --metadata data/metadata.json \
  --warmup 5 --runs 30 --repeat 50 \
  --stability-enable --stability-mode wait \
  --enforce-single-thread --cpu-affinity 2 \
  --impls c-naive,cpp-naive,rust-naive,go-naive,java-naive,python-naive,python-numpy \
  --ebpf-agent http://localhost:9090
```

### 3. Generate Report

```bash
python3 report-builder/build_report.py \
  --runner-results runner/results.csv \
  --runner-summary runner/summary.json \
  --ebpf-evidence agent-ebpf/evidence.json \
  --output report.json
```

### 4. View in Business UI

```bash
cd ui-business
npm install
npm run dev
# Open http://localhost:5173 and drag&drop report.json
```

### 5. Monitor with Prometheus/Grafana

```bash
docker-compose up -d
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9091
```

## Core Principles

### Machine-Agnostic Comparison

- **Never compare absolute times across machines**
- Always compute `baseline vs optimized` on the **same machine** → gain%
- Aggregate across machines using **ratios** (median, p10/p90)
- Track gain% stability over time via Prometheus

### Chain Metaphor (Non-Negotiable)

ChainBench does NOT optimize hardware (CPU/GPU/RAM/BIOS).  
It reduces **dead time between chain links**:

- CPU Wait (scheduler latency)
- Blocking/Off-CPU Time (locks, futex, I/O sync)
- I/O Latency (disk/filesystem)
- Execution Overhead (fork/exec, syscalls)
- Memory Pressure (page faults, RSS)

### Gain Calculation (Strict Definition)

```
median_baseline_ms = median(baseline_runs)
median_optimized_ms = median(optimized_runs)
delta_ms = median_baseline_ms - median_optimized_ms
gain_pct = (delta_ms / median_baseline_ms) * 100
```

Verdict: `conclusive` if low CV% and low distribution overlap, else `inconclusive`.

## Directory Structure

```
Core_Cut/
├── runner/                 # Benchmark orchestrator (existing)
├── agent-ebpf/            # eBPF evidence collector + Prometheus /metrics
├── report-builder/        # Aggregates runner + eBPF → report.json
├── ui-business/           # React+TS business interface
├── prometheus/            # Prometheus config
├── grafana/              # Dashboard JSON + provisioning
├── docker-compose.yml    # Observability stack
├── docs/                 # Documentation
└── examples/             # Example report.json files
```

## Requirements

- **Runner**: Python 3.8+, C/C++/Rust/Go/Java compilers
- **eBPF Agent**: Linux kernel 5.8+, BCC/bpftrace, Go 1.21+
- **UI**: Node.js 18+, npm/pnpm
- **Observability**: Docker + docker-compose

## Documentation

- [Installation Guide](docs/installation.md)
- [Usage Guide](docs/usage.md)
- [Mental Model](docs/mental-model.md)
- [Report Schema](docs/report-schema.md)
- [eBPF Evidence](docs/ebpf-evidence.md)

## Anti-Bullshit Rules

- ❌ Never display "BIOS optimized"
- ❌ Never display "GPU" if not measured
- ❌ Never invent scores
- ✅ All scores derived from traceable raw metrics
- ✅ Always preserve raw samples + stats
- ✅ Always display reproducibility (dataset hash, seed, mono-thread)

## License
Louis PROTON
# ChainBench
