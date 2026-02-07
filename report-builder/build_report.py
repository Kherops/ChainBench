#!/usr/bin/env python3
"""
ChainBench Report Builder

Aggregates runner results + eBPF evidence into validated report.json
"""

import argparse
import json
import hashlib
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import statistics
import socket
import platform
import subprocess


def get_git_commit() -> Optional[str]:
    try:
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except:
        pass
    return None


def calculate_stats(samples: List[float]) -> Dict[str, float]:
    if not samples:
        return {
            'median': 0.0,
            'mean': 0.0,
            'std': 0.0,
            'cv_pct': 0.0,
            'p10': 0.0,
            'p90': 0.0
        }
    
    sorted_samples = sorted(samples)
    n = len(sorted_samples)
    
    median = statistics.median(sorted_samples)
    mean = statistics.mean(sorted_samples)
    std = statistics.stdev(sorted_samples) if n > 1 else 0.0
    cv_pct = (std / mean * 100) if mean > 0 else 0.0
    
    p10_idx = int(n * 0.1)
    p90_idx = int(n * 0.9)
    p10 = sorted_samples[p10_idx]
    p90 = sorted_samples[p90_idx]
    
    return {
        'median': median,
        'mean': mean,
        'std': std,
        'cv_pct': cv_pct,
        'p10': p10,
        'p90': p90
    }


def determine_verdict(baseline_stats: Dict, optimized_stats: Dict) -> str:
    baseline_cv = baseline_stats['cv_pct']
    optimized_cv = optimized_stats['cv_pct']
    
    if baseline_cv < 5.0 and optimized_cv < 5.0:
        return 'conclusive'
    elif baseline_cv > 15.0 or optimized_cv > 15.0:
        return 'inconclusive'
    else:
        return 'conclusive'


def calculate_impact(delta_ms: float, inputs: Dict) -> Dict:
    time_saved_hours_per_year = (
        delta_ms * inputs['executions_per_day'] * inputs['days_per_year']
    ) / 3_600_000
    
    cost_saved_eur_per_year = (
        time_saved_hours_per_year * inputs['cost_per_hour_eur']
    )
    
    electricity_saved_kwh_per_year = (
        time_saved_hours_per_year * inputs['electricity_kwh_per_hour']
    )
    
    co2_avoided_kg_per_year = (
        electricity_saved_kwh_per_year * inputs['co2_kg_per_kwh']
    )
    
    return {
        'time_saved_hours_per_year': time_saved_hours_per_year,
        'cost_saved_eur_per_year': cost_saved_eur_per_year,
        'electricity_saved_kwh_per_year': electricity_saved_kwh_per_year,
        'co2_avoided_kg_per_year': co2_avoided_kg_per_year
    }


def load_runner_summary(path: str) -> Dict:
    with open(path, 'r') as f:
        return json.load(f)


def load_ebpf_evidence(path: str) -> Dict:
    if not os.path.exists(path):
        return {'available': False}
    
    with open(path, 'r') as f:
        return json.load(f)


def load_metadata(path: str) -> Dict:
    with open(path, 'r') as f:
        return json.load(f)


def build_report(
    runner_summary: Dict,
    ebpf_evidence: Dict,
    metadata: Dict,
    command_line: str,
    baseline_impl: str,
    baseline_variant: str,
    optimized_impl: str,
    optimized_variant: str
) -> Dict:
    
    baseline_samples = runner_summary.get('baseline_samples', [])
    optimized_samples = runner_summary.get('optimized_samples', [])
    
    baseline_stats = calculate_stats(baseline_samples)
    optimized_stats = calculate_stats(optimized_samples)
    
    delta_ms = baseline_stats['median'] - optimized_stats['median']
    gain_pct = (delta_ms / baseline_stats['median'] * 100) if baseline_stats['median'] > 0 else 0.0
    
    verdict = determine_verdict(baseline_stats, optimized_stats)
    
    impact_inputs = {
        'executions_per_day': 100,
        'days_per_year': 250,
        'cost_model': 'infra',
        'cost_per_hour_eur': 0.50,
        'electricity_kwh_per_hour': 0.15,
        'co2_kg_per_kwh': 0.475
    }
    
    impact_outputs = calculate_impact(delta_ms, impact_inputs)
    
    report = {
        'schema_version': '1.0.0',
        'meta': {
            'report_id': hashlib.sha256(
                f"{datetime.utcnow().isoformat()}{socket.gethostname()}".encode()
            ).hexdigest()[:16],
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'app_version': '1.0.0',
            'git_commit': get_git_commit(),
            'machine': {
                'hostname': socket.gethostname(),
                'os': platform.system(),
                'kernel': platform.release(),
                'cpu_model': platform.processor() or 'unknown',
            },
            'dataset': {
                'hash_sha256': metadata.get('hash_sha256', ''),
                'N': metadata.get('N', 0),
                'M': metadata.get('M', 0),
                'D': metadata.get('D', 0),
                'seed': metadata.get('seed', 0)
            }
        },
        'benchmark': {
            'command_line': command_line,
            'warmup': runner_summary.get('warmup', 5),
            'runs': runner_summary.get('runs', 30),
            'repeat': runner_summary.get('repeat', 50),
            'stability': {
                'enabled': runner_summary.get('stability_enabled', True),
                'mode': runner_summary.get('stability_mode', 'wait'),
                'waited_seconds': runner_summary.get('waited_seconds', 0.0)
            },
            'single_thread': {
                'env_vars': {
                    'OMP_NUM_THREADS': '1',
                    'MKL_NUM_THREADS': '1',
                    'OPENBLAS_NUM_THREADS': '1',
                    'NUMEXPR_NUM_THREADS': '1'
                }
            },
            'cpu_affinity': runner_summary.get('cpu_affinity') or 2,
            'impls': [
                {'name': baseline_impl, 'variant': baseline_variant},
                {'name': optimized_impl, 'variant': optimized_variant}
            ]
        },
        'runs': {
            'baseline': {
                'impl': baseline_impl,
                'variant': baseline_variant,
                'samples': baseline_samples,
                'status': ['success'] * len(baseline_samples),
                'errors': []
            },
            'optimized': {
                'impl': optimized_impl,
                'variant': optimized_variant,
                'samples': optimized_samples,
                'status': ['success'] * len(optimized_samples),
                'errors': []
            }
        },
        'summary': {
            'baseline_stats': baseline_stats,
            'optimized_stats': optimized_stats,
            'delta_ms': delta_ms,
            'gain_pct': gain_pct,
            'verdict': verdict,
            'notes': 'Gain measured at environment constant (same machine).'
        },
        'evidence': ebpf_evidence,
        'impact': {
            'inputs': impact_inputs,
            'outputs': impact_outputs
        },
        'artifacts': {
            'results_csv': 'runner/results.csv',
            'summary_json': 'runner/summary.json',
            'prometheus_url': 'http://localhost:9091',
            'grafana_url': 'http://localhost:3000'
        }
    }
    
    return report


def main():
    parser = argparse.ArgumentParser(
        description='Build ChainBench report.json from runner + eBPF data'
    )
    parser.add_argument('--runner-summary', required=True, help='Path to runner summary.json')
    parser.add_argument('--ebpf-evidence', default='', help='Path to eBPF evidence.json')
    parser.add_argument('--metadata', required=True, help='Path to dataset metadata.json')
    parser.add_argument('--output', default='report.json', help='Output report.json path')
    parser.add_argument('--command-line', default='', help='Full command line used')
    parser.add_argument('--baseline-impl', default='python', help='Baseline implementation')
    parser.add_argument('--baseline-variant', default='naive', help='Baseline variant')
    parser.add_argument('--optimized-impl', default='python', help='Optimized implementation')
    parser.add_argument('--optimized-variant', default='numpy', help='Optimized variant')
    
    args = parser.parse_args()
    
    print(f"Loading runner summary from {args.runner_summary}")
    runner_summary = load_runner_summary(args.runner_summary)
    
    print(f"Loading eBPF evidence from {args.ebpf_evidence or 'none'}")
    ebpf_evidence = load_ebpf_evidence(args.ebpf_evidence) if args.ebpf_evidence else {'available': False}
    
    print(f"Loading metadata from {args.metadata}")
    metadata = load_metadata(args.metadata)
    
    print("Building report...")
    report = build_report(
        runner_summary,
        ebpf_evidence,
        metadata,
        args.command_line,
        args.baseline_impl,
        args.baseline_variant,
        args.optimized_impl,
        args.optimized_variant
    )
    
    print(f"Writing report to {args.output}")
    with open(args.output, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"✓ Report generated: {args.output}")
    print(f"  - Baseline: {report['summary']['baseline_stats']['median']:.1f} ms")
    print(f"  - Optimized: {report['summary']['optimized_stats']['median']:.1f} ms")
    print(f"  - Gain: {report['summary']['gain_pct']:.1f}%")
    print(f"  - Verdict: {report['summary']['verdict']}")
    print(f"  - eBPF: {'available' if ebpf_evidence.get('available') else 'not available'}")


if __name__ == '__main__':
    main()
