#!/usr/bin/env python3
"""
Resource profiler for ChainBench

Samples CPU, RAM, I/O, and optionally GPU usage during benchmark execution.
"""

import psutil
import time
from typing import Dict, List, Optional
import threading


class ResourceProfiler:
    """Profiles system resource usage during benchmark execution."""
    
    def __init__(self, pid: Optional[int] = None, sample_interval: float = 0.1):
        """
        Initialize profiler.
        
        Args:
            pid: Process ID to monitor (None for system-wide)
            sample_interval: Sampling interval in seconds
        """
        self.pid = pid
        self.sample_interval = sample_interval
        self.samples = []
        self.running = False
        self.thread = None
        self.process = None
        
        if pid:
            try:
                self.process = psutil.Process(pid)
            except psutil.NoSuchProcess:
                self.process = None
    
    def _sample_resources(self) -> Dict:
        """Sample current resource usage."""
        sample = {
            'timestamp': time.time()
        }
        
        if self.process:
            # Process-specific metrics
            try:
                sample['cpu_percent'] = self.process.cpu_percent(interval=0.01)
                mem_info = self.process.memory_info()
                sample['ram_mb'] = mem_info.rss / (1024 * 1024)
                
                # I/O counters (if available)
                try:
                    io_counters = self.process.io_counters()
                    sample['io_read_mb'] = io_counters.read_bytes / (1024 * 1024)
                    sample['io_write_mb'] = io_counters.write_bytes / (1024 * 1024)
                except (AttributeError, psutil.AccessDenied):
                    sample['io_read_mb'] = 0
                    sample['io_write_mb'] = 0
                
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                sample['cpu_percent'] = 0
                sample['ram_mb'] = 0
                sample['io_read_mb'] = 0
                sample['io_write_mb'] = 0
        else:
            # System-wide metrics
            sample['cpu_percent'] = psutil.cpu_percent(interval=0.01)
            mem = psutil.virtual_memory()
            sample['ram_mb'] = mem.used / (1024 * 1024)
            
            # Disk I/O
            try:
                io_counters = psutil.disk_io_counters()
                sample['io_read_mb'] = io_counters.read_bytes / (1024 * 1024)
                sample['io_write_mb'] = io_counters.write_bytes / (1024 * 1024)
            except:
                sample['io_read_mb'] = 0
                sample['io_write_mb'] = 0
        
        # GPU (placeholder - requires nvidia-smi or similar)
        sample['gpu_percent'] = 0  # TODO: Add GPU monitoring if available
        
        return sample
    
    def _profiling_loop(self):
        """Background thread that samples resources."""
        start_time = time.time()
        
        while self.running:
            sample = self._sample_resources()
            sample['elapsed_ms'] = (sample['timestamp'] - start_time) * 1000
            self.samples.append(sample)
            time.sleep(self.sample_interval)
    
    def start(self):
        """Start profiling."""
        if self.running:
            return
        
        self.samples = []
        self.running = True
        self.thread = threading.Thread(target=self._profiling_loop, daemon=True)
        self.thread.start()
    
    def stop(self) -> List[Dict]:
        """Stop profiling and return samples."""
        if not self.running:
            return self.samples
        
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        
        return self.samples
    
    def get_summary(self) -> Dict:
        """Get summary statistics from samples."""
        if not self.samples:
            return {
                'cpu_avg': 0,
                'cpu_max': 0,
                'ram_avg_mb': 0,
                'ram_max_mb': 0,
                'io_total_mb': 0,
                'gpu_avg': 0,
                'duration_ms': 0
            }
        
        cpu_values = [s['cpu_percent'] for s in self.samples]
        ram_values = [s['ram_mb'] for s in self.samples]
        gpu_values = [s['gpu_percent'] for s in self.samples]
        
        # Calculate I/O delta (total transferred)
        if len(self.samples) > 1:
            io_read_delta = self.samples[-1]['io_read_mb'] - self.samples[0]['io_read_mb']
            io_write_delta = self.samples[-1]['io_write_mb'] - self.samples[0]['io_write_mb']
            io_total = max(0, io_read_delta + io_write_delta)
        else:
            io_total = 0
        
        duration_ms = self.samples[-1]['elapsed_ms'] if self.samples else 0
        
        return {
            'cpu_avg': sum(cpu_values) / len(cpu_values),
            'cpu_max': max(cpu_values),
            'ram_avg_mb': sum(ram_values) / len(ram_values),
            'ram_max_mb': max(ram_values),
            'io_total_mb': io_total,
            'gpu_avg': sum(gpu_values) / len(gpu_values) if gpu_values else 0,
            'duration_ms': duration_ms,
            'sample_count': len(self.samples)
        }
    
    def get_profile_curve(self, points: int = 50) -> Dict:
        """
        Get downsampled profile curve for visualization.
        
        Args:
            points: Number of points in the curve
            
        Returns:
            Dict with arrays for each metric
        """
        if not self.samples:
            return {
                'timestamps': [],
                'cpu': [],
                'ram': [],
                'io': [],
                'gpu': []
            }
        
        # Downsample if we have more samples than requested points
        if len(self.samples) > points:
            step = len(self.samples) // points
            downsampled = self.samples[::step][:points]
        else:
            downsampled = self.samples
        
        # Normalize timestamps to 0-100 scale
        if downsampled:
            start_time = downsampled[0]['elapsed_ms']
            end_time = downsampled[-1]['elapsed_ms']
            duration = end_time - start_time if end_time > start_time else 1
            
            timestamps = [
                ((s['elapsed_ms'] - start_time) / duration) * 100 
                for s in downsampled
            ]
        else:
            timestamps = []
        
        return {
            'timestamps': timestamps,
            'cpu': [s['cpu_percent'] for s in downsampled],
            'ram': [s['ram_mb'] for s in downsampled],
            'io': [s['io_read_mb'] + s['io_write_mb'] for s in downsampled],
            'gpu': [s['gpu_percent'] for s in downsampled]
        }


def profile_function(func, *args, **kwargs):
    """
    Profile a function execution.
    
    Args:
        func: Function to profile
        *args, **kwargs: Arguments to pass to function
        
    Returns:
        Tuple of (result, profile_data)
    """
    profiler = ResourceProfiler()
    profiler.start()
    
    try:
        result = func(*args, **kwargs)
    finally:
        samples = profiler.stop()
    
    return result, {
        'samples': samples,
        'summary': profiler.get_summary(),
        'curve': profiler.get_profile_curve()
    }
