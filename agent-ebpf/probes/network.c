// SPDX-License-Identifier: GPL-2.0
// Network monitoring eBPF probes for ChainBench
// Captures TCP/UDP connections, latency, bandwidth, retransmissions

#include <uapi/linux/ptrace.h>
#include <net/sock.h>
#include <bcc/proto.h>

// Data structures
struct tcp_connect_event_t {
    u32 pid;
    u32 tid;
    char comm[16];
    u32 saddr;
    u32 daddr;
    u16 sport;
    u16 dport;
    u64 timestamp_ns;
};

struct tcp_bandwidth_t {
    u32 pid;
    u64 bytes_sent;
    u64 bytes_received;
    u64 packets_sent;
    u64 packets_received;
};

struct tcp_retrans_t {
    u32 pid;
    u32 saddr;
    u32 daddr;
    u16 sport;
    u16 dport;
    u64 count;
};

struct udp_traffic_t {
    u32 pid;
    u64 bytes_sent;
    u64 bytes_received;
    u64 packets_sent;
    u64 packets_received;
};

// Maps
BPF_HASH(tcp_connections, u32, struct tcp_connect_event_t);
BPF_HASH(tcp_bandwidth, u32, struct tcp_bandwidth_t);
BPF_HASH(tcp_retrans, u64, struct tcp_retrans_t);
BPF_HASH(udp_traffic, u32, struct udp_traffic_t);
BPF_PERF_OUTPUT(tcp_events);

// Probe: TCP connect
int trace_tcp_connect(struct pt_regs *ctx, struct sock *sk) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct tcp_connect_event_t event = {};
    event.pid = pid;
    event.tid = bpf_get_current_pid_tgid();
    bpf_get_current_comm(&event.comm, sizeof(event.comm));
    event.timestamp_ns = bpf_ktime_get_ns();
    
    u16 family = sk->__sk_common.skc_family;
    if (family == AF_INET) {
        event.saddr = sk->__sk_common.skc_rcv_saddr;
        event.daddr = sk->__sk_common.skc_daddr;
        event.sport = sk->__sk_common.skc_num;
        event.dport = sk->__sk_common.skc_dport;
        event.dport = ntohs(event.dport);
    }
    
    tcp_connections.update(&pid, &event);
    tcp_events.perf_submit(ctx, &event, sizeof(event));
    
    return 0;
}

// Probe: TCP send bytes
int trace_tcp_sendmsg(struct pt_regs *ctx, struct sock *sk, struct msghdr *msg, size_t size) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct tcp_bandwidth_t *bw = tcp_bandwidth.lookup(&pid);
    if (!bw) {
        struct tcp_bandwidth_t new_bw = {};
        new_bw.pid = pid;
        new_bw.bytes_sent = size;
        new_bw.packets_sent = 1;
        tcp_bandwidth.update(&pid, &new_bw);
    } else {
        bw->bytes_sent += size;
        bw->packets_sent += 1;
    }
    
    return 0;
}

// Probe: TCP receive bytes
int trace_tcp_recvmsg(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    int ret = PT_REGS_RC(ctx);
    
    if (ret > 0) {
        struct tcp_bandwidth_t *bw = tcp_bandwidth.lookup(&pid);
        if (!bw) {
            struct tcp_bandwidth_t new_bw = {};
            new_bw.pid = pid;
            new_bw.bytes_received = ret;
            new_bw.packets_received = 1;
            tcp_bandwidth.update(&pid, &new_bw);
        } else {
            bw->bytes_received += ret;
            bw->packets_received += 1;
        }
    }
    
    return 0;
}

// Probe: TCP retransmissions
int trace_tcp_retransmit_skb(struct pt_regs *ctx, struct sock *sk) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    u64 key = 0;
    if (sk->__sk_common.skc_family == AF_INET) {
        key = ((u64)sk->__sk_common.skc_daddr << 32) | sk->__sk_common.skc_rcv_saddr;
    }
    
    struct tcp_retrans_t *retrans = tcp_retrans.lookup(&key);
    if (!retrans) {
        struct tcp_retrans_t new_retrans = {};
        new_retrans.pid = pid;
        new_retrans.saddr = sk->__sk_common.skc_rcv_saddr;
        new_retrans.daddr = sk->__sk_common.skc_daddr;
        new_retrans.sport = sk->__sk_common.skc_num;
        new_retrans.dport = ntohs(sk->__sk_common.skc_dport);
        new_retrans.count = 1;
        tcp_retrans.update(&key, &new_retrans);
    } else {
        retrans->count += 1;
    }
    
    return 0;
}

// Probe: UDP send
int trace_udp_sendmsg(struct pt_regs *ctx, struct sock *sk, struct msghdr *msg, size_t len) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    struct udp_traffic_t *traffic = udp_traffic.lookup(&pid);
    if (!traffic) {
        struct udp_traffic_t new_traffic = {};
        new_traffic.pid = pid;
        new_traffic.bytes_sent = len;
        new_traffic.packets_sent = 1;
        udp_traffic.update(&pid, &new_traffic);
    } else {
        traffic->bytes_sent += len;
        traffic->packets_sent += 1;
    }
    
    return 0;
}

// Probe: UDP receive
int trace_udp_recvmsg(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    int ret = PT_REGS_RC(ctx);
    
    if (ret > 0) {
        struct udp_traffic_t *traffic = udp_traffic.lookup(&pid);
        if (!traffic) {
            struct udp_traffic_t new_traffic = {};
            new_traffic.pid = pid;
            new_traffic.bytes_received = ret;
            new_traffic.packets_received = 1;
            udp_traffic.update(&pid, &new_traffic);
        } else {
            traffic->bytes_received += ret;
            traffic->packets_received += 1;
        }
    }
    
    return 0;
}
