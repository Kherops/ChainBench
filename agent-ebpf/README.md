# ChainBench eBPF Agent

Kernel-level evidence collector with Prometheus metrics export.

## Features

- **Best-effort eBPF collection**: Falls back gracefully if eBPF unavailable
- **Prometheus /metrics endpoint**: Long-term tracking and alerting
- **HTTP API**: Start/stop collection, retrieve evidence
- **Aggregated metrics only**: No raw event streams (performance-safe)

## Requirements

- Linux kernel 5.8+
- BCC tools or bpftrace (optional, for actual eBPF collection)
- CAP_BPF or sudo (for eBPF probes)

## Build

```bash
cd agent-ebpf
go build -o bin/chainbench-agent
```

## Usage

### Start Agent

```bash
# Without eBPF (mock data)
./bin/chainbench-agent --port 9090

# With eBPF (requires sudo)
sudo ./bin/chainbench-agent --port 9090
```

### API Endpoints

#### Start Collection

```bash
curl -X POST http://localhost:9090/start \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "baseline",
    "impl": "python",
    "variant": "numpy",
    "commit": "abc123",
    "dataset": "sha256hash"
  }'
```

#### Stop Collection & Get Evidence

```bash
curl -X POST http://localhost:9090/stop
```

Returns:
```json
{
  "available": true,
  "runqlat": {
    "histogram": [...],
    "p95_us": 45.0
  },
  "biolatency": {...},
  "offcpu": {...},
  "exec": {...},
  "syscall_counts": {...}
}
```

#### Check Status

```bash
curl http://localhost:9090/status
```

#### Report Benchmark Metrics

```bash
curl -X POST http://localhost:9090/report \
  -H "Content-Type: application/json" \
  -d '{
    "impl": "python",
    "variant": "numpy",
    "commit": "abc123",
    "dataset": "sha256hash",
    "baseline_ms": 1500.0,
    "optimized_ms": 1200.0,
    "gain_pct": 20.0
  }'
```

#### Prometheus Metrics

```bash
curl http://localhost:9090/metrics
```

## Metrics Exported

### Histograms
- `chainbench_runqlat_microseconds` - CPU scheduler latency
- `chainbench_biolatency_microseconds` - Block I/O latency

### Gauges
- `chainbench_offcpu_milliseconds_total` - Off-CPU time
- `chainbench_duration_milliseconds` - Benchmark duration
- `chainbench_gain_percent` - Performance gain

### Counters
- `chainbench_exec_count_total` - Process exec count
- `chainbench_syscall_count_total` - Syscall counts by type
- `chainbench_runs_total` - Total benchmark runs

All metrics include labels: `scenario`, `impl`, `variant`, `commit`, `machine`, `dataset`

## eBPF Probes (when available)

- **runqlat**: Scheduler runqueue latency (p95 + histogram)
- **biolatency**: Block I/O latency (p95 + histogram)
- **offcputime**: Off-CPU time total + top reasons
- **execsnoop**: Process execution count + top commands
- **syscall counts**: futex, fsync, openat, read, write

## Fallback Behavior

If eBPF tools are not available:
- Agent runs normally
- Returns `"available": false` in evidence
- Benchmarks continue without kernel-level insights
- Prometheus metrics still exported (from runner data)

## Integration with Runner

```python
import requests

# Start collection
requests.post('http://localhost:9090/start', json={
    'scenario': 'baseline',
    'impl': 'python',
    'variant': 'numpy',
    'commit': get_git_commit(),
    'dataset': dataset_hash
})

# Run benchmark
result = run_benchmark()

# Stop and get evidence
evidence = requests.post('http://localhost:9090/stop').json()

# Report metrics to Prometheus
requests.post('http://localhost:9090/report', json={
    'impl': 'python',
    'variant': 'numpy',
    'commit': get_git_commit(),
    'dataset': dataset_hash,
    'baseline_ms': baseline_median,
    'optimized_ms': optimized_median,
    'gain_pct': gain_percent
})
```

## Security Notes

- eBPF requires elevated privileges (CAP_BPF or root)
- Agent should run on localhost only in production
- Consider firewall rules for /metrics endpoint
- No authentication implemented (add reverse proxy if needed)
