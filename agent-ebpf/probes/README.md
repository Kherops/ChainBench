# eBPF Probes for ChainBench

Complete eBPF monitoring suite capturing kernel-level metrics for performance analysis.

## Modules Overview

### 1. **network.c** - Network Monitoring
Captures network activity like Wireshark but at kernel level.

**Metrics collected:**
- TCP connections (connect/accept)
- TCP bandwidth (bytes sent/received, packets)
- TCP retransmissions
- UDP traffic (bytes, packets)
- Network latency (RTT estimation)

**Use cases:**
- API/microservice benchmarks
- Network-bound applications
- Distributed systems

**Probes:**
```c
trace_tcp_connect()         // TCP connection establishment
trace_tcp_sendmsg()         // TCP data sent
trace_tcp_recvmsg()         // TCP data received
trace_tcp_retransmit_skb()  // TCP retransmissions
trace_udp_sendmsg()         // UDP data sent
trace_udp_recvmsg()         // UDP data received
```

### 2. **memory.c** - Memory Monitoring
Deep memory subsystem analysis.

**Metrics collected:**
- Page faults (minor/major)
- Memory allocations (kmalloc/kfree)
- Cache misses (L1/L2/L3)
- TLB misses
- OOM events
- Swap activity (in/out)

**Use cases:**
- Memory-bound applications
- Cache optimization
- Memory leak detection
- OOM debugging

**Probes:**
```c
trace_handle_mm_fault()     // Page fault handler
trace_kmalloc()             // Memory allocation
trace_oom_kill_process()    // OOM killer
trace_cache_miss()          // CPU cache misses
trace_swap_readpage()       // Swap in
trace_swap_writepage()      // Swap out
```

### 3. **io.c** - I/O Monitoring
Comprehensive filesystem and block I/O analysis.

**Metrics collected:**
- File operations (open/close/read/write)
- File operation latency
- Page cache hits/misses
- Block I/O queue depth
- I/O scheduler latency
- Filesystem sync operations (fsync/fdatasync)

**Use cases:**
- I/O-bound applications
- Database benchmarks
- File processing workloads
- Storage performance analysis

**Probes:**
```c
trace_do_sys_open()         // File open
trace_vfs_read()            // File read
trace_vfs_write()           // File write
trace_filp_close()          // File close
trace_mark_page_accessed()  // Page cache hit
trace_add_to_page_cache_lru() // Page cache miss
trace_blk_account_io_start() // Block I/O start
trace_blk_account_io_done()  // Block I/O completion
trace_do_fsync()            // Filesystem sync
```

### 4. **cpu.c** - CPU Monitoring
Advanced CPU scheduling and power management.

**Metrics collected:**
- Context switches (voluntary/involuntary)
- CPU migrations
- Hardware interrupts
- Software interrupts (softirqs)
- CPU throttling events
- Wakeup latency
- CPU frequency changes
- CPU idle time (C-states)

**Use cases:**
- CPU-bound applications
- Scheduler analysis
- Power consumption optimization
- Real-time performance

**Probes:**
```c
sched_switch              // Context switches
sched_migrate_task        // CPU migrations
irq_handler_entry         // Hardware interrupts
softirq_entry             // Software interrupts
sched_cfs_period_timer    // CPU throttling
sched_wakeup              // Process wakeup
cpu_frequency             // CPU freq changes
cpu_idle                  // CPU idle states
```

### 5. **locks.c** - Lock Contention Monitoring
Synchronization primitive analysis for detecting bottlenecks.

**Metrics collected:**
- Mutex contention
- Mutex wait time
- Spinlock hold time
- Futex waits (userspace locks)
- RCU stalls
- Semaphore operations
- Deadlock detection (lock ordering violations)

**Use cases:**
- Multi-threaded applications
- Lock contention analysis
- Deadlock debugging
- Synchronization optimization

**Probes:**
```c
trace_mutex_lock()        // Mutex lock attempt
trace_mutex_unlock()      // Mutex unlock
trace_spin_lock()         // Spinlock acquire
trace_spin_unlock()       // Spinlock release
trace_futex_wait()        // Futex wait
trace_futex_wake()        // Futex wake
trace_rcu_stall_warning() // RCU stalls
trace_sem_wait()          // Semaphore wait
trace_lock_acquire()      // Generic lock (deadlock detection)
```

## Building and Loading

### Prerequisites
```bash
# Install BCC tools
sudo apt-get install bpfcc-tools linux-headers-$(uname -r)

# Or build from source
git clone https://github.com/iovisor/bcc.git
cd bcc
mkdir build && cd build
cmake ..
make && sudo make install
```

### Compile Probes
```bash
cd agent-ebpf/probes

# Compile all probes
clang -O2 -target bpf -c network.c -o network.o
clang -O2 -target bpf -c memory.c -o memory.o
clang -O2 -target bpf -c io.c -o io.o
clang -O2 -target bpf -c cpu.c -o cpu.o
clang -O2 -target bpf -c locks.c -o locks.o
```

### Load with BCC (Python)
```python
from bcc import BPF

# Load network probes
b = BPF(src_file="network.c")
b.attach_kprobe(event="tcp_v4_connect", fn_name="trace_tcp_connect")
b.attach_kprobe(event="tcp_sendmsg", fn_name="trace_tcp_sendmsg")
# ... attach other probes

# Read data
tcp_bandwidth = b["tcp_bandwidth"]
for k, v in tcp_bandwidth.items():
    print(f"PID {k.value}: {v.bytes_sent} bytes sent")
```

### Load with Go Agent
```bash
cd agent-ebpf
go build -o bin/chainbench-agent
sudo ./bin/chainbench-agent --port 9090 --probes all
```

## Metrics Export

All metrics are exported via:
1. **Prometheus `/metrics` endpoint** - For time-series monitoring
2. **JSON API `/report` endpoint** - For ChainBench reports
3. **Perf events** - Real-time event stream

## Performance Impact

**Overhead per probe:**
- Network: ~0.1-0.5% CPU overhead
- Memory: ~0.2-1% CPU overhead
- I/O: ~0.1-0.3% CPU overhead
- CPU: ~0.5-1% CPU overhead (high frequency events)
- Locks: ~0.2-0.5% CPU overhead

**Total overhead with all probes:** ~1-3% CPU

**Recommendation:** Enable only needed probes for production benchmarks.

## Security Considerations

eBPF probes run in kernel space with elevated privileges:
- Requires `CAP_BPF` or `CAP_SYS_ADMIN` capability
- Probes are verified by kernel verifier (safe by design)
- Cannot crash the kernel (verified bounds checking)
- Limited stack size (512 bytes)
- No unbounded loops allowed

## Troubleshooting

### Probe fails to attach
```bash
# Check if kernel supports eBPF
cat /proc/sys/kernel/unprivileged_bpf_disabled

# Check kernel version (need 4.4+, recommended 5.8+)
uname -r

# Check if BCC is installed
python3 -c "import bcc; print(bcc.__version__)"
```

### Missing kernel symbols
```bash
# Check available kprobes
cat /sys/kernel/debug/tracing/available_filter_functions | grep tcp_connect

# Use tracepoints instead of kprobes (more stable)
cat /sys/kernel/debug/tracing/available_events | grep sched
```

### High overhead
```bash
# Disable high-frequency probes
--probes network,memory,io  # Skip cpu and locks

# Increase sampling interval
--sample-interval 1000  # Sample every 1000 events instead of all
```

## Integration with ChainBench

The Go agent automatically:
1. Loads all probes at startup
2. Collects metrics during benchmark execution
3. Aggregates data per process/implementation
4. Exports to Prometheus and JSON
5. Includes metrics in `report.json`

**Example report.json with all metrics:**
```json
{
  "evidence": {
    "available": true,
    "network": {
      "tcp_connections": 42,
      "tcp_bytes_sent": 1048576,
      "tcp_retransmissions": 3,
      "udp_packets": 128
    },
    "memory": {
      "page_faults_minor": 1250,
      "page_faults_major": 12,
      "cache_hits": 98500,
      "cache_misses": 1500
    },
    "io": {
      "file_opens": 45,
      "file_reads_bytes": 2097152,
      "cache_hit_ratio": 98.5,
      "avg_io_latency_us": 120
    },
    "cpu": {
      "context_switches": 3420,
      "cpu_migrations": 15,
      "interrupts": 8900,
      "throttle_events": 0
    },
    "locks": {
      "mutex_contentions": 8,
      "futex_waits": 245,
      "avg_wait_time_us": 45
    }
  }
}
```

## References

- [BCC Tools](https://github.com/iovisor/bcc)
- [eBPF Documentation](https://ebpf.io/)
- [Linux Tracing Systems](https://www.kernel.org/doc/html/latest/trace/index.html)
- [Brendan Gregg's eBPF Tools](http://www.brendangregg.com/ebpf.html)
