// SPDX-License-Identifier: GPL-2.0
// Lock monitoring eBPF probes for ChainBench
// Captures mutex contention, spinlock hold time, futex waits, deadlocks

#include <uapi/linux/ptrace.h>
#include <linux/sched.h>

// Data structures
struct mutex_contention_t {
    u32 pid;
    char comm[16];
    u64 lock_addr;
    u64 wait_time_ns;
    u64 timestamp_ns;
};

struct spinlock_hold_t {
    u32 pid;
    u64 lock_addr;
    u64 hold_time_ns;
    u32 cpu;
};

struct futex_wait_t {
    u32 pid;
    char comm[16];
    u64 uaddr;
    u64 wait_time_ns;
    u32 op;
};

struct deadlock_event_t {
    u32 pid1;
    u32 pid2;
    char comm1[16];
    char comm2[16];
    u64 lock1_addr;
    u64 lock2_addr;
    u64 timestamp_ns;
};

// Maps
BPF_HASH(mutex_lock_start, u64, u64); // key: lock_addr, value: start_ns
BPF_HASH(mutex_contentions, u32, u64); // key: pid, value: total_contentions
BPF_HASH(mutex_wait_time, u32, u64); // key: pid, value: total_wait_ns
BPF_HASH(spinlock_start, u64, u64); // key: lock_addr, value: start_ns
BPF_HASH(spinlock_holds, u32, u64); // key: pid, value: total_holds
BPF_HASH(spinlock_hold_time, u32, u64); // key: pid, value: total_hold_ns
BPF_HASH(futex_start, u64, u64); // key: tid, value: start_ns
BPF_HASH(futex_waits, u32, u64); // key: pid, value: total_waits
BPF_HASH(futex_wait_time, u32, u64); // key: pid, value: total_wait_ns
BPF_PERF_OUTPUT(contention_events);
BPF_PERF_OUTPUT(deadlock_events);

// Probe: Mutex lock attempt
int trace_mutex_lock(struct pt_regs *ctx, struct mutex *lock) {
    u64 lock_addr = (u64)lock;
    u64 ts = bpf_ktime_get_ns();
    
    mutex_lock_start.update(&lock_addr, &ts);
    
    return 0;
}

// Probe: Mutex lock acquired
int trace_mutex_lock_ret(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    int ret = PT_REGS_RC(ctx);
    
    // If ret != 0, lock acquisition failed or was contended
    if (ret != 0) {
        u64 *count = mutex_contentions.lookup(&pid);
        if (!count) {
            u64 new_count = 1;
            mutex_contentions.update(&pid, &new_count);
        } else {
            (*count)++;
        }
    }
    
    return 0;
}

// Probe: Mutex unlock
int trace_mutex_unlock(struct pt_regs *ctx, struct mutex *lock) {
    u64 lock_addr = (u64)lock;
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *start_ns = mutex_lock_start.lookup(&lock_addr);
    if (start_ns) {
        u64 hold_time = bpf_ktime_get_ns() - *start_ns;
        
        // If hold time is very long, this was contended
        if (hold_time > 1000000) { // > 1ms
            u64 *wait = mutex_wait_time.lookup(&pid);
            if (!wait) {
                mutex_wait_time.update(&pid, &hold_time);
            } else {
                *wait += hold_time;
            }
            
            struct mutex_contention_t event = {};
            event.pid = pid;
            bpf_get_current_comm(&event.comm, sizeof(event.comm));
            event.lock_addr = lock_addr;
            event.wait_time_ns = hold_time;
            event.timestamp_ns = bpf_ktime_get_ns();
            
            contention_events.perf_submit(ctx, &event, sizeof(event));
        }
        
        mutex_lock_start.delete(&lock_addr);
    }
    
    return 0;
}

// Probe: Spinlock acquire
int trace_spin_lock(struct pt_regs *ctx, void *lock) {
    u64 lock_addr = (u64)lock;
    u64 ts = bpf_ktime_get_ns();
    
    spinlock_start.update(&lock_addr, &ts);
    
    return 0;
}

// Probe: Spinlock release
int trace_spin_unlock(struct pt_regs *ctx, void *lock) {
    u64 lock_addr = (u64)lock;
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *start_ns = spinlock_start.lookup(&lock_addr);
    if (start_ns) {
        u64 hold_time = bpf_ktime_get_ns() - *start_ns;
        
        u64 *count = spinlock_holds.lookup(&pid);
        if (!count) {
            u64 new_count = 1;
            spinlock_holds.update(&pid, &new_count);
        } else {
            (*count)++;
        }
        
        u64 *total_time = spinlock_hold_time.lookup(&pid);
        if (!total_time) {
            spinlock_hold_time.update(&pid, &hold_time);
        } else {
            *total_time += hold_time;
        }
        
        spinlock_start.delete(&lock_addr);
    }
    
    return 0;
}

// Probe: Futex wait (userspace locks)
int trace_futex_wait(struct pt_regs *ctx, u32 __user *uaddr, int op) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    u64 ts = bpf_ktime_get_ns();
    
    futex_start.update(&tid, &ts);
    
    u64 *count = futex_waits.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        futex_waits.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

// Probe: Futex wake (lock released)
int trace_futex_wake(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    
    u64 *start_ns = futex_start.lookup(&tid);
    if (start_ns) {
        u64 wait_time = bpf_ktime_get_ns() - *start_ns;
        
        u64 *total_wait = futex_wait_time.lookup(&pid);
        if (!total_wait) {
            futex_wait_time.update(&pid, &wait_time);
        } else {
            *total_wait += wait_time;
        }
        
        futex_start.delete(&tid);
    }
    
    return 0;
}

// Probe: RCU stalls
BPF_HASH(rcu_stalls, u32, u64);

int trace_rcu_stall_warning(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *count = rcu_stalls.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        rcu_stalls.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

// Probe: Semaphore operations
BPF_HASH(sem_waits, u32, u64);
BPF_HASH(sem_wait_time, u32, u64);
BPF_HASH(sem_wait_start, u64, u64);

int trace_sem_wait(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    u64 ts = bpf_ktime_get_ns();
    
    sem_wait_start.update(&tid, &ts);
    
    u64 *count = sem_waits.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        sem_waits.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

int trace_sem_post(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 tid = bpf_get_current_pid_tgid();
    
    u64 *start_ns = sem_wait_start.lookup(&tid);
    if (start_ns) {
        u64 wait_time = bpf_ktime_get_ns() - *start_ns;
        
        u64 *total_wait = sem_wait_time.lookup(&pid);
        if (!total_wait) {
            sem_wait_time.update(&pid, &wait_time);
        } else {
            *total_wait += wait_time;
        }
        
        sem_wait_start.delete(&tid);
    }
    
    return 0;
}

// Deadlock detection (simplified - tracks lock ordering)
BPF_HASH(lock_order, u64, u64); // key: pid, value: last_lock_addr

int trace_lock_acquire(struct pt_regs *ctx, void *lock) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 lock_addr = (u64)lock;
    
    u64 *last_lock = lock_order.lookup(&pid);
    if (last_lock && *last_lock > lock_addr) {
        // Potential lock ordering violation (acquiring lower address after higher)
        // This is a simple heuristic for deadlock detection
        struct deadlock_event_t event = {};
        event.pid1 = pid;
        event.pid2 = 0; // Would need more complex tracking
        bpf_get_current_comm(&event.comm1, sizeof(event.comm1));
        event.lock1_addr = *last_lock;
        event.lock2_addr = lock_addr;
        event.timestamp_ns = bpf_ktime_get_ns();
        
        deadlock_events.perf_submit(ctx, &event, sizeof(event));
    }
    
    lock_order.update(&pid, &lock_addr);
    
    return 0;
}
