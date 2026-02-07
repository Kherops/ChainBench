#!/usr/bin/env python3
"""
ChainBench Dataset Generator

Generates reproducible synthetic datasets for benchmarking.
"""

import argparse
import hashlib
import json
import os
import struct
import sys
from pathlib import Path
import numpy as np


def generate_dataset(N: int, M: int, D: int, seed: int, output_dir: str):
    """
    Generate synthetic dataset for benchmarking.
    
    Args:
        N: Number of embeddings
        M: Number of axes
        D: Dimensions per embedding
        seed: Random seed for reproducibility
        output_dir: Output directory
    """
    np.random.seed(seed)
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    print(f"Generating dataset: N={N}, M={M}, D={D}, seed={seed}")
    
    # Generate embeddings (N x D matrix)
    print(f"  Generating {N} embeddings of dimension {D}...")
    embeddings = np.random.randn(N, D).astype(np.float64)
    embeddings_file = output_path / "embeddings.f64"
    embeddings.tofile(embeddings_file)
    print(f"  ✓ Saved to {embeddings_file}")
    
    # Generate axes (M x D matrix)
    print(f"  Generating {M} axes of dimension {D}...")
    axes = np.random.randn(M, D).astype(np.float64)
    axes_file = output_path / "axes.f64"
    axes.tofile(axes_file)
    print(f"  ✓ Saved to {axes_file}")
    
    # Calculate dataset hash
    print("  Calculating dataset hash...")
    hasher = hashlib.sha256()
    hasher.update(embeddings.tobytes())
    hasher.update(axes.tobytes())
    dataset_hash = hasher.hexdigest()
    print(f"  ✓ Hash: {dataset_hash[:16]}...")
    
    # Generate metadata
    metadata = {
        "hash_sha256": dataset_hash,
        "N": N,
        "M": M,
        "D": D,
        "seed": seed,
        "embeddings_file": "embeddings.f64",
        "axes_file": "axes.f64",
        "embeddings_shape": [N, D],
        "axes_shape": [M, D],
        "dtype": "float64",
        "size_bytes": {
            "embeddings": N * D * 8,
            "axes": M * D * 8,
            "total": (N * D + M * D) * 8
        }
    }
    
    metadata_file = output_path / "metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✓ Saved metadata to {metadata_file}")
    
    # Create dataset lock file
    lock_file = output_path / "dataset.lock"
    with open(lock_file, 'w') as f:
        f.write(dataset_hash)
    print(f"  ✓ Created lock file {lock_file}")
    
    print(f"\n✓ Dataset generation complete!")
    print(f"  Total size: {metadata['size_bytes']['total'] / 1024 / 1024:.2f} MB")
    print(f"  Hash: {dataset_hash}")
    
    return metadata


def verify_dataset(output_dir: str):
    """Verify dataset integrity."""
    output_path = Path(output_dir)
    
    metadata_file = output_path / "metadata.json"
    if not metadata_file.exists():
        print("✗ metadata.json not found")
        return False
    
    with open(metadata_file, 'r') as f:
        metadata = json.load(f)
    
    embeddings_file = output_path / metadata['embeddings_file']
    axes_file = output_path / metadata['axes_file']
    
    if not embeddings_file.exists():
        print(f"✗ {embeddings_file} not found")
        return False
    
    if not axes_file.exists():
        print(f"✗ {axes_file} not found")
        return False
    
    # Verify hash
    N, D = metadata['embeddings_shape']
    M = metadata['axes_shape'][0]
    
    embeddings = np.fromfile(embeddings_file, dtype=np.float64).reshape(N, D)
    axes = np.fromfile(axes_file, dtype=np.float64).reshape(M, D)
    
    hasher = hashlib.sha256()
    hasher.update(embeddings.tobytes())
    hasher.update(axes.tobytes())
    calculated_hash = hasher.hexdigest()
    
    if calculated_hash != metadata['hash_sha256']:
        print(f"✗ Hash mismatch!")
        print(f"  Expected: {metadata['hash_sha256']}")
        print(f"  Got:      {calculated_hash}")
        return False
    
    print(f"✓ Dataset verified: {calculated_hash[:16]}...")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Generate reproducible synthetic dataset for ChainBench',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate default dataset
  python3 data/generate_data.py --N 2000 --M 15 --D 96 --seed 42

  # Generate large dataset
  python3 data/generate_data.py --N 10000 --M 20 --D 128 --seed 123

  # Force overwrite existing dataset
  python3 data/generate_data.py --N 2000 --M 15 --D 96 --seed 42 --force

  # Verify existing dataset
  python3 data/generate_data.py --verify
        """
    )
    
    parser.add_argument('--N', type=int, default=2000,
                        help='Number of embeddings (default: 2000)')
    parser.add_argument('--M', type=int, default=15,
                        help='Number of axes (default: 15)')
    parser.add_argument('--D', type=int, default=96,
                        help='Dimensions (default: 96)')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed (default: 42)')
    parser.add_argument('--output', type=str, default='data',
                        help='Output directory (default: data)')
    parser.add_argument('--force', action='store_true',
                        help='Force overwrite existing dataset')
    parser.add_argument('--verify', action='store_true',
                        help='Verify existing dataset integrity')
    
    args = parser.parse_args()
    
    if args.verify:
        print("Verifying dataset...")
        if verify_dataset(args.output):
            print("✓ Dataset is valid")
            sys.exit(0)
        else:
            print("✗ Dataset verification failed")
            sys.exit(1)
    
    # Check if dataset already exists
    output_path = Path(args.output)
    metadata_file = output_path / "metadata.json"
    
    if metadata_file.exists() and not args.force:
        print(f"✗ Dataset already exists at {args.output}")
        print("  Use --force to overwrite or --verify to check integrity")
        sys.exit(1)
    
    # Validate parameters
    if args.N <= 0 or args.M <= 0 or args.D <= 0:
        print("✗ N, M, and D must be positive integers")
        sys.exit(1)
    
    # Generate dataset
    try:
        metadata = generate_dataset(args.N, args.M, args.D, args.seed, args.output)
        
        # Verify what we just generated
        if verify_dataset(args.output):
            print("\n✓ Dataset verified successfully")
        else:
            print("\n✗ Dataset verification failed after generation")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n✗ Error generating dataset: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
