# ChainBench Mental Model

Understanding the philosophy and principles behind ChainBench.

## Core Philosophy

### The Chain Metaphor

ChainBench views software performance through the lens of a **chain**, not individual components.

**Traditional view** (❌ Wrong):
- "This CPU is faster"
- "This GPU has more TFLOPS"
- "This RAM has lower latency"

**ChainBench view** (✅ Correct):
- "Where are the **dead times** between chain links?"
- "Why is the thread **waiting** instead of working?"
- "What **structural inefficiencies** slow the whole chain?"

### What We Measure

ChainBench focuses on **time losses**, not component speeds:

1. **CPU Wait (Scheduler Latency)**
   - Time waiting in runqueue
   - Scheduler contention
   - Core availability

2. **Blocking / Off-CPU Time**
   - Locks (mutex, futex)
   - Synchronous I/O
   - Thread coordination

3. **I/O Latency**
   - Disk access time
   - Filesystem overhead
   - Buffer cache misses

4. **Execution Overhead**
   - Process creation (fork/exec)
   - Syscall volume
   - Context switches

5. **Memory Pressure**
   - Page faults
   - RSS growth
   - Copy overhead

### What We Don't Measure

❌ **Hardware specs** (CPU GHz, GPU cores, RAM speed)
❌ **Theoretical peaks** (TFLOPS, bandwidth)
❌ **Component benchmarks** (Geekbench, 3DMark)

These are **inputs**, not **outcomes**. ChainBench measures **actual wall time** and **where it's spent**.

## Machine-Agnostic Comparison

### The Golden Rule

**Never compare absolute times across different machines.**

### Why?

Different hardware produces different absolute times, but:
- The **direction** of improvement often transfers
- The **ratio** of gain is more stable than absolute times
- **Structural improvements** (fewer locks, less I/O) help everywhere

### Correct Approach

1. **Measure baseline vs optimized on SAME machine**
2. **Calculate gain% = (delta / baseline) × 100**
3. **Track gain% stability over time**
4. **Aggregate ratios across machines** (median, p10/p90)

### Example

**Machine A** (laptop):
- Baseline: 1500ms
- Optimized: 1200ms
- **Gain: 20%**

**Machine B** (server):
- Baseline: 800ms
- Optimized: 640ms
- **Gain: 20%**

✅ **Conclusion**: Optimization provides ~20% gain consistently
❌ **Wrong**: "Server is 2x faster" (irrelevant to optimization)

## Gain Calculation (Strict Definition)

```
median_baseline_ms = median(baseline_runs)
median_optimized_ms = median(optimized_runs)

delta_ms = median_baseline_ms - median_optimized_ms
gain_pct = (delta_ms / median_baseline_ms) × 100
```

### Verdict Criteria

**Conclusive**:
- Low coefficient of variation (CV < 10%)
- Minimal distribution overlap
- Stable measurements

**Inconclusive**:
- High CV (> 15%)
- Large distribution overlap
- Unstable system

### Why Median, Not Mean?

- **Robust to outliers**: One bad run doesn't skew results
- **Represents typical case**: 50th percentile
- **Stable metric**: Less sensitive to noise

## Evidence-Based Performance

### The Problem with Traditional Benchmarks

Traditional benchmarks report:
- "Python is 50x slower than C"
- "NumPy speeds up by 10x"

But they don't explain **why** or **where**.

### ChainBench's Approach

1. **Measure** wall time (ground truth)
2. **Prove** with eBPF (kernel evidence)
3. **Explain** with metrics (scheduler, I/O, locks)
4. **Valorize** with impact (€, kWh, CO₂)

### eBPF Evidence

eBPF probes provide **kernel-level proof**:

- **runqlat**: "Scheduler latency decreased 40%"
- **biolatency**: "I/O latency reduced 25%"
- **offcputime**: "Blocking time cut in half"
- **execsnoop**: "33% fewer process creations"
- **syscalls**: "60% fewer futex calls"

This is **evidence**, not speculation.

## Business Impact Translation

### From Technical to Business

ChainBench translates performance into business value:

**Technical**: "307ms faster per execution"

**Business**:
- ⏱ **2.1 hours saved per year**
- 💰 **€1,066 saved per year**
- ⚡ **0.32 kWh saved per year**
- 🌍 **0.15 kg CO₂ avoided per year**

### Customizable Assumptions

Impact depends on:
- **Execution frequency**: How often does this run?
- **Cost model**: Infrastructure or human time?
- **Electricity rate**: kWh per hour
- **CO₂ intensity**: Grid carbon intensity

All assumptions are **explicit** and **editable** in the UI.

### Why This Matters

- **Non-technical stakeholders** understand €, not ms
- **Decision-makers** need ROI, not CV%
- **Sustainability teams** track CO₂, not FLOPS

## Reproducibility Principles

### Dataset Lock

`dataset.lock` ensures:
- Same data for all comparisons
- No accidental cross-dataset comparison
- Reproducible checksums

### Stability Control

Before each run:
- CPU usage < 20%
- Disk I/O < 5 MB/s
- RAM available > 2GB
- No swap activity
- Load average stable

Modes:
- **wait**: Wait up to timeout (default)
- **skip**: Skip this run
- **fail**: Abort benchmark

### Single-Thread Enforcement

```bash
OMP_NUM_THREADS=1
MKL_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
NUMEXPR_NUM_THREADS=1
GOMAXPROCS=1
```

Prevents:
- Thread pool interference
- Non-deterministic parallelism
- Cross-run variability

### CPU Affinity

Pin process to single core:
```bash
taskset -c 2 ./benchmark
```

Benefits:
- Consistent cache behavior
- No core migration
- Reduced variability

## Long-Term Tracking

### Why Prometheus + Grafana?

- **Historical data**: Track gain% over time
- **Regression detection**: Alert on degradation
- **Trend analysis**: Is performance improving?
- **Multi-machine aggregation**: Compare across fleet

### Metrics vs UI

**UI (report.json)**:
- Detailed analysis
- One-time reports
- Auditable evidence
- Offline viewing

**Prometheus/Grafana**:
- Time-series data
- Continuous monitoring
- Alerting
- Fleet-wide view

Both are **complementary**, not redundant.

## Anti-Bullshit Rules

### Never Say

❌ "BIOS optimized"
❌ "GPU accelerated" (if not measured)
❌ "10x faster" (without context)
❌ "Optimized for performance" (vague)

### Always Say

✅ "Scheduler latency reduced 40%"
✅ "Blocking time decreased from 1250ms to 890ms"
✅ "20% gain at environment constant"
✅ "Evidence: 60% fewer futex calls"

### Traceability

Every claim must be:
- **Measured**: Raw samples available
- **Proven**: eBPF evidence or metrics
- **Reproducible**: Dataset, seed, config documented
- **Auditable**: JSON schema validated

## Success Criteria

### For Non-Technical Users

Can they:
- ✅ Understand the gain% immediately?
- ✅ See the € impact clearly?
- ✅ Trust the measurement is serious?
- ✅ Explain it to their manager?

### For Technical Users

Can they:
- ✅ Audit the methodology?
- ✅ Verify the calculations?
- ✅ Reproduce the results?
- ✅ Understand the kernel evidence?

### For Decision-Makers

Can they:
- ✅ Justify the investment?
- ✅ Track ROI over time?
- ✅ Compare alternatives?
- ✅ Report to stakeholders?

## Common Misconceptions

### "Faster CPU = Better Performance"

**Wrong**: A faster CPU might not help if:
- You're I/O bound (disk latency)
- You're lock bound (synchronization)
- You're memory bound (cache misses)

**ChainBench shows**: Where the actual bottleneck is.

### "This Language is Always Faster"

**Wrong**: Performance depends on:
- Algorithm choice
- Data structure
- I/O patterns
- Parallelism strategy

**ChainBench shows**: Actual wall time + evidence.

### "Optimization is Always Worth It"

**Wrong**: Sometimes:
- Gain is too small (< 5%)
- Cost is too high (developer time)
- Risk is too great (complexity)

**ChainBench shows**: Quantified gain + business impact.

## Design Principles

1. **Measure outcomes, not inputs**
2. **Prove with evidence, not speculation**
3. **Compare ratios, not absolutes**
4. **Track stability, not just speed**
5. **Translate to business value**
6. **Maintain auditability**
7. **Enable reproducibility**
8. **Avoid bullshit**

## Further Reading

- [Usage Guide](usage.md) - How to use ChainBench
- [Report Schema](report-schema.md) - JSON structure
- [eBPF Evidence](ebpf-evidence.md) - Kernel insights
- [Installation](installation.md) - Setup guide
