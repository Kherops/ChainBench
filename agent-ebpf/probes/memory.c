// SPDX-License-Identifier: GPL-2.0
// Memory monitoring eBPF probes for ChainBench
// Captures page faults, cache misses, allocations, OOM events

#include <uapi/linux/ptrace.h>
#include <linux/mm.h>

// Data structures
struct page_fault_t {
    u32 pid;
    u64 address;
    u32 flags;
    u64 timestamp_ns;
    u8 is_major;
};

struct memory_alloc_t {
    u32 pid;
    u64 size;
    u64 ptr;
    u64 timestamp_ns;
};

struct cache_miss_t {
    u32 pid;
    u64 l1_misses;
    u64 l2_misses;
    u64 l3_misses;
    u64 tlb_misses;
};

struct oom_event_t {
    u32 pid;
    char comm[16];
    u64 timestamp_ns;
    u64 pages_requested;
};

// Maps
BPF_HASH(page_faults_minor, u32, u64);
BPF_HASH(page_faults_major, u32, u64);
BPF_HASH(memory_allocations, u32, struct memory_alloc_t);
BPF_HASH(cache_misses, u32, struct cache_miss_t);
BPF_PERF_OUTPUT(page_fault_events);
BPF_PERF_OUTPUT(oom_events);

// Probe: Page fault handler
int trace_handle_mm_fault(struct pt_regs *ctx, struct vm_area_struct *vma, 
                          unsigned long address, unsigned int flags) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct page_fault_t event = {};
    event.pid = pid;
    event.address = address;
    event.flags = flags;
    event.timestamp_ns = bpf_ktime_get_ns();
    
    // Check if major page fault (disk I/O required)
    event.is_major = (flags & 0x1) ? 1 : 0;
    
    if (event.is_major) {
        u64 *count = page_faults_major.lookup(&pid);
        if (!count) {
            u64 new_count = 1;
            page_faults_major.update(&pid, &new_count);
        } else {
            (*count)++;
        }
    } else {
        u64 *count = page_faults_minor.lookup(&pid);
        if (!count) {
            u64 new_count = 1;
            page_faults_minor.update(&pid, &new_count);
        } else {
            (*count)++;
        }
    }
    
    page_fault_events.perf_submit(ctx, &event, sizeof(event));
    return 0;
}

// Probe: Memory allocation (kmalloc)
int trace_kmalloc(struct pt_regs *ctx, size_t size) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct memory_alloc_t alloc = {};
    alloc.pid = pid;
    alloc.size = size;
    alloc.timestamp_ns = bpf_ktime_get_ns();
    
    memory_allocations.update(&pid, &alloc);
    return 0;
}

// Probe: Memory allocation return (get pointer)
int trace_kmalloc_ret(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 ptr = PT_REGS_RC(ctx);
    
    struct memory_alloc_t *alloc = memory_allocations.lookup(&pid);
    if (alloc) {
        alloc->ptr = ptr;
    }
    
    return 0;
}

// Probe: OOM killer
int trace_oom_kill_process(struct pt_regs *ctx, struct oom_control *oc, const char *message) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct oom_event_t event = {};
    event.pid = pid;
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    event.timestamp_ns = bpf_ktime_get_ns();
    event.pages_requested = 0; // Would need to extract from oc
    
    oom_events.perf_submit(ctx, &event, sizeof(event));
    return 0;
}

// Probe: Cache misses (via perf events)
// Note: This requires perf_event_open integration
int trace_cache_miss(struct bpf_perf_event_data *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct cache_miss_t *misses = cache_misses.lookup(&pid);
    if (!misses) {
        struct cache_miss_t new_misses = {};
        new_misses.pid = pid;
        new_misses.l1_misses = 1;
        cache_misses.update(&pid, &new_misses);
    } else {
        misses->l1_misses++;
    }
    
    return 0;
}

// Probe: Swap in/out events
BPF_HASH(swap_in_count, u32, u64);
BPF_HASH(swap_out_count, u32, u64);

int trace_swap_readpage(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *count = swap_in_count.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        swap_in_count.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

int trace_swap_writepage(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *count = swap_out_count.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        swap_out_count.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}
