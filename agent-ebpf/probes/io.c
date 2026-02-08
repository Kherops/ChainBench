// SPDX-License-Identifier: GPL-2.0
// I/O monitoring eBPF probes for ChainBench
// Captures file operations, cache hits/misses, queue depth, I/O scheduler latency

#include <uapi/linux/ptrace.h>
#include <linux/fs.h>
#include <linux/blkdev.h>

// Data structures
struct file_op_t {
    u32 pid;
    char comm[16];
    char filename[256];
    u8 op_type; // 0=open, 1=close, 2=read, 3=write
    u64 size;
    u64 timestamp_ns;
    u64 latency_ns;
};

struct cache_stat_t {
    u32 pid;
    u64 cache_hits;
    u64 cache_misses;
    u64 readahead_hits;
};

struct io_queue_t {
    u32 pid;
    u64 queue_depth;
    u64 max_queue_depth;
    u64 total_requests;
};

struct io_latency_t {
    u32 pid;
    u64 min_latency_ns;
    u64 max_latency_ns;
    u64 total_latency_ns;
    u64 count;
};

// Maps
BPF_HASH(file_opens, u32, u64);
BPF_HASH(file_reads, u32, u64);
BPF_HASH(file_writes, u32, u64);
BPF_HASH(file_closes, u32, u64);
BPF_HASH(cache_stats, u32, struct cache_stat_t);
BPF_HASH(io_queue, u32, struct io_queue_t);
BPF_HASH(io_latency, u32, struct io_latency_t);
BPF_HASH(file_op_start, u64, u64); // key: tid, value: start_ns
BPF_PERF_OUTPUT(file_events);

// Probe: File open
int trace_do_sys_open(struct pt_regs *ctx, int dfd, const char __user *filename, int flags) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    
    u64 ts = bpf_ktime_get_ns();
    file_op_start.update(&tid, &ts);
    
    u64 *count = file_opens.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        file_opens.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

int trace_do_sys_open_ret(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    
    u64 *start_ns = file_op_start.lookup(&tid);
    if (start_ns) {
        u64 latency = bpf_ktime_get_ns() - *start_ns;
        
        struct io_latency_t *lat = io_latency.lookup(&pid);
        if (!lat) {
            struct io_latency_t new_lat = {};
            new_lat.pid = pid;
            new_lat.min_latency_ns = latency;
            new_lat.max_latency_ns = latency;
            new_lat.total_latency_ns = latency;
            new_lat.count = 1;
            io_latency.update(&pid, &new_lat);
        } else {
            if (latency < lat->min_latency_ns) lat->min_latency_ns = latency;
            if (latency > lat->max_latency_ns) lat->max_latency_ns = latency;
            lat->total_latency_ns += latency;
            lat->count++;
        }
        
        file_op_start.delete(&tid);
    }
    
    return 0;
}

// Probe: File read
int trace_vfs_read(struct pt_regs *ctx, struct file *file, char __user *buf, size_t count) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    
    u64 ts = bpf_ktime_get_ns();
    file_op_start.update(&tid, &ts);
    
    u64 *reads = file_reads.lookup(&pid);
    if (!reads) {
        u64 new_count = count;
        file_reads.update(&pid, &new_count);
    } else {
        (*reads) += count;
    }
    
    return 0;
}

// Probe: File write
int trace_vfs_write(struct pt_regs *ctx, struct file *file, const char __user *buf, size_t count) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    
    u64 ts = bpf_ktime_get_ns();
    file_op_start.update(&tid, &ts);
    
    u64 *writes = file_writes.lookup(&pid);
    if (!writes) {
        u64 new_count = count;
        file_writes.update(&pid, &new_count);
    } else {
        (*writes) += count;
    }
    
    return 0;
}

// Probe: File close
int trace_filp_close(struct pt_regs *ctx, struct file *filp) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *count = file_closes.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        file_closes.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

// Probe: Page cache hit
int trace_mark_page_accessed(struct pt_regs *ctx, struct page *page) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct cache_stat_t *stats = cache_stats.lookup(&pid);
    if (!stats) {
        struct cache_stat_t new_stats = {};
        new_stats.pid = pid;
        new_stats.cache_hits = 1;
        cache_stats.update(&pid, &new_stats);
    } else {
        stats->cache_hits++;
    }
    
    return 0;
}

// Probe: Page cache miss (page fault leading to I/O)
int trace_add_to_page_cache_lru(struct pt_regs *ctx, struct page *page) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct cache_stat_t *stats = cache_stats.lookup(&pid);
    if (!stats) {
        struct cache_stat_t new_stats = {};
        new_stats.pid = pid;
        new_stats.cache_misses = 1;
        cache_stats.update(&pid, &new_stats);
    } else {
        stats->cache_misses++;
    }
    
    return 0;
}

// Probe: Block I/O queue insertion
int trace_blk_account_io_start(struct pt_regs *ctx, struct request *req) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct io_queue_t *queue = io_queue.lookup(&pid);
    if (!queue) {
        struct io_queue_t new_queue = {};
        new_queue.pid = pid;
        new_queue.queue_depth = 1;
        new_queue.max_queue_depth = 1;
        new_queue.total_requests = 1;
        io_queue.update(&pid, &new_queue);
    } else {
        queue->queue_depth++;
        queue->total_requests++;
        if (queue->queue_depth > queue->max_queue_depth) {
            queue->max_queue_depth = queue->queue_depth;
        }
    }
    
    return 0;
}

// Probe: Block I/O completion
int trace_blk_account_io_done(struct pt_regs *ctx, struct request *req) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct io_queue_t *queue = io_queue.lookup(&pid);
    if (queue && queue->queue_depth > 0) {
        queue->queue_depth--;
    }
    
    return 0;
}

// Probe: Filesystem sync operations
BPF_HASH(fsync_count, u32, u64);
BPF_HASH(fdatasync_count, u32, u64);

int trace_do_fsync(struct pt_regs *ctx, unsigned int fd, int datasync) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    if (datasync) {
        u64 *count = fdatasync_count.lookup(&pid);
        if (!count) {
            u64 new_count = 1;
            fdatasync_count.update(&pid, &new_count);
        } else {
            (*count)++;
        }
    } else {
        u64 *count = fsync_count.lookup(&pid);
        if (!count) {
            u64 new_count = 1;
            fsync_count.update(&pid, &new_count);
        } else {
            (*count)++;
        }
    }
    
    return 0;
}
