// SPDX-License-Identifier: GPL-2.0
// CPU monitoring eBPF probes for ChainBench
// Captures context switches, CPU migrations, interrupts, throttling

#include <uapi/linux/ptrace.h>
#include <linux/sched.h>

// Data structures
struct context_switch_t {
    u32 prev_pid;
    u32 next_pid;
    char prev_comm[16];
    char next_comm[16];
    u32 cpu;
    u64 timestamp_ns;
};

struct cpu_migration_t {
    u32 pid;
    char comm[16];
    u32 from_cpu;
    u32 to_cpu;
    u64 timestamp_ns;
};

struct interrupt_t {
    u32 irq;
    char name[32];
    u64 count;
    u64 total_time_ns;
};

struct throttle_event_t {
    u32 pid;
    char comm[16];
    u64 timestamp_ns;
    u64 throttled_time_ns;
};

// Maps
BPF_HASH(context_switches, u32, u64);
BPF_HASH(cpu_migrations, u32, u64);
BPF_HASH(voluntary_switches, u32, u64);
BPF_HASH(involuntary_switches, u32, u64);
BPF_HASH(interrupts, u32, struct interrupt_t);
BPF_HASH(softirqs, u32, u64);
BPF_HASH(throttle_events, u32, u64);
BPF_PERF_OUTPUT(switch_events);
BPF_PERF_OUTPUT(migration_events);

// Probe: Context switch
TRACEPOINT_PROBE(sched, sched_switch) {
    u32 prev_pid = args->prev_pid;
    u32 next_pid = args->next_pid;
    
    // Count context switches for prev process
    u64 *count = context_switches.lookup(&prev_pid);
    if (!count) {
        u64 new_count = 1;
        context_switches.update(&prev_pid, &new_count);
    } else {
        (*count)++;
    }
    
    // Determine if voluntary or involuntary
    // prev_state == 0 means involuntary (preempted)
    if (args->prev_state == 0) {
        u64 *inv_count = involuntary_switches.lookup(&prev_pid);
        if (!inv_count) {
            u64 new_count = 1;
            involuntary_switches.update(&prev_pid, &new_count);
        } else {
            (*inv_count)++;
        }
    } else {
        u64 *vol_count = voluntary_switches.lookup(&prev_pid);
        if (!vol_count) {
            u64 new_count = 1;
            voluntary_switches.update(&prev_pid, &new_count);
        } else {
            (*vol_count)++;
        }
    }
    
    // Emit event
    struct context_switch_t event = {};
    event.prev_pid = prev_pid;
    event.next_pid = next_pid;
    __builtin_memcpy(&event.prev_comm, args->prev_comm, sizeof(event.prev_comm));
    __builtin_memcpy(&event.next_comm, args->next_comm, sizeof(event.next_comm));
    event.cpu = bpf_get_smp_processor_id();
    event.timestamp_ns = bpf_ktime_get_ns();
    
    switch_events.perf_submit(args, &event, sizeof(event));
    
    return 0;
}

// Probe: CPU migration
TRACEPOINT_PROBE(sched, sched_migrate_task) {
    u32 pid = args->pid;
    u32 orig_cpu = args->orig_cpu;
    u32 dest_cpu = args->dest_cpu;
    
    u64 *count = cpu_migrations.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        cpu_migrations.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    struct cpu_migration_t event = {};
    event.pid = pid;
    __builtin_memcpy(&event.comm, args->comm, sizeof(event.comm));
    event.from_cpu = orig_cpu;
    event.to_cpu = dest_cpu;
    event.timestamp_ns = bpf_ktime_get_ns();
    
    migration_events.perf_submit(args, &event, sizeof(event));
    
    return 0;
}

// Probe: Hardware interrupt entry
TRACEPOINT_PROBE(irq, irq_handler_entry) {
    u32 irq = args->irq;
    
    struct interrupt_t *intr = interrupts.lookup(&irq);
    if (!intr) {
        struct interrupt_t new_intr = {};
        __builtin_memcpy(&new_intr.name, args->name, sizeof(new_intr.name));
        new_intr.count = 1;
        interrupts.update(&irq, &new_intr);
    } else {
        intr->count++;
    }
    
    return 0;
}

// Probe: Softirq entry
TRACEPOINT_PROBE(irq, softirq_entry) {
    u32 vec = args->vec;
    
    u64 *count = softirqs.lookup(&vec);
    if (!count) {
        u64 new_count = 1;
        softirqs.update(&vec, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

// Probe: CPU throttling (CFS bandwidth control)
TRACEPOINT_PROBE(sched, sched_cfs_period_timer) {
    // This fires when a cgroup hits its CPU quota
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *count = throttle_events.lookup(&pid);
    if (!count) {
        u64 new_count = 1;
        throttle_events.update(&pid, &new_count);
    } else {
        (*count)++;
    }
    
    return 0;
}

// Probe: Process wakeup (for wakeup latency)
BPF_HASH(wakeup_time, u32, u64);

TRACEPOINT_PROBE(sched, sched_wakeup) {
    u32 pid = args->pid;
    u64 ts = bpf_ktime_get_ns();
    
    wakeup_time.update(&pid, &ts);
    
    return 0;
}

TRACEPOINT_PROBE(sched, sched_waking) {
    u32 pid = args->pid;
    u64 ts = bpf_ktime_get_ns();
    
    wakeup_time.update(&pid, &ts);
    
    return 0;
}

// Calculate wakeup latency when process actually runs
BPF_HASH(wakeup_latency, u32, u64);

int trace_finish_task_switch(struct pt_regs *ctx, struct task_struct *prev) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 *wakeup_ts = wakeup_time.lookup(&pid);
    if (wakeup_ts) {
        u64 now = bpf_ktime_get_ns();
        u64 latency = now - *wakeup_ts;
        
        u64 *total_latency = wakeup_latency.lookup(&pid);
        if (!total_latency) {
            wakeup_latency.update(&pid, &latency);
        } else {
            *total_latency += latency;
        }
        
        wakeup_time.delete(&pid);
    }
    
    return 0;
}

// Probe: CPU frequency changes
BPF_HASH(cpu_freq_changes, u32, u64);

TRACEPOINT_PROBE(power, cpu_frequency) {
    u32 cpu = args->cpu_id;
    u64 freq = args->state;
    
    cpu_freq_changes.update(&cpu, &freq);
    
    return 0;
}

// Probe: CPU idle state changes
BPF_HASH(cpu_idle_time, u32, u64);
BPF_HASH(cpu_idle_start, u32, u64);

TRACEPOINT_PROBE(power, cpu_idle) {
    u32 cpu = bpf_get_smp_processor_id();
    u64 state = args->state;
    u64 now = bpf_ktime_get_ns();
    
    if (state != (u64)-1) {
        // Entering idle
        cpu_idle_start.update(&cpu, &now);
    } else {
        // Exiting idle
        u64 *start = cpu_idle_start.lookup(&cpu);
        if (start) {
            u64 idle_duration = now - *start;
            
            u64 *total = cpu_idle_time.lookup(&cpu);
            if (!total) {
                cpu_idle_time.update(&cpu, &idle_duration);
            } else {
                *total += idle_duration;
            }
            
            cpu_idle_start.delete(&cpu);
        }
    }
    
    return 0;
}
