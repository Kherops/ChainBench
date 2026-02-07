# ChainBench Installation Guide

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended), macOS, or WSL2
- **CPU**: Multi-core processor (for CPU affinity features)
- **RAM**: 4GB minimum, 8GB+ recommended
- **Disk**: 2GB free space

### Software Dependencies

#### Core Tools
- Python 3.8+
- Node.js 18+
- Go 1.21+ (for eBPF agent)
- Docker & Docker Compose (for observability stack)
- Git

#### eBPF Tools (Optional, Linux only)
- BCC tools or bpftrace
- Linux kernel 5.8+
- CAP_BPF capability or sudo access

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/Kherops/ChainBench.git
cd Core_Cut
```

### 2. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Build eBPF Agent

```bash
cd agent-ebpf
go mod download
go build -o bin/chainbench-agent
cd ..
```

### 4. Install UI Dependencies

```bash
cd ui-business
npm install
cd ..
```

### 5. Setup Observability Stack

```bash
# Start Prometheus & Grafana
docker-compose up -d

# Verify services
docker-compose ps
```

Access:
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9091

### 6. Verify Installation

```bash
# Check Python
python3 --version

# Check Go agent
./agent-ebpf/bin/chainbench-agent --help

# Check Node/npm
node --version
npm --version

# Check Docker
docker --version
docker-compose --version
```

## Platform-Specific Notes

### Linux

**eBPF Setup**:
```bash
# Ubuntu/Debian
sudo apt-get install bpfcc-tools linux-headers-$(uname -r)

# Fedora/RHEL
sudo dnf install bcc-tools kernel-devel

# Verify eBPF
sudo bpftrace --version
```

**Capabilities** (alternative to sudo):
```bash
sudo setcap cap_bpf,cap_perfmon,cap_sys_resource=ep ./agent-ebpf/bin/chainbench-agent
```

### macOS

eBPF is **not available** on macOS. The agent will run in fallback mode (no kernel-level evidence).

```bash
# Install dependencies via Homebrew
brew install python node go docker
```

### Windows (WSL2)

1. Install WSL2 with Ubuntu
2. Follow Linux installation steps inside WSL2
3. Docker Desktop with WSL2 backend recommended

## Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# eBPF Agent
EBPF_AGENT_PORT=9090

# Prometheus
PROMETHEUS_PORT=9091

# Grafana
GRAFANA_PORT=3000
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin

# UI
UI_PORT=5173
```

### CPU Affinity

Check available CPU cores:
```bash
nproc  # Linux
sysctl -n hw.ncpu  # macOS
```

Set CPU affinity in benchmark runs (use core ID 0 to N-1).

## Troubleshooting

### eBPF Agent Won't Start

**Issue**: Permission denied
```bash
# Solution 1: Run with sudo
sudo ./agent-ebpf/bin/chainbench-agent

# Solution 2: Add capabilities
sudo setcap cap_bpf,cap_perfmon=ep ./agent-ebpf/bin/chainbench-agent
```

**Issue**: eBPF tools not found
```bash
# Install BCC tools (see Platform-Specific Notes)
# Agent will run in fallback mode if unavailable
```

### Docker Compose Issues

**Issue**: Port already in use
```bash
# Check what's using the port
sudo lsof -i :9091  # Prometheus
sudo lsof -i :3000  # Grafana

# Change ports in docker-compose.yml
```

**Issue**: Permission denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### UI Build Errors

**Issue**: Module not found
```bash
cd ui-business
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Port 5173 in use
```bash
# Change port in vite.config.ts
# Or kill existing process
lsof -ti:5173 | xargs kill -9
```

## Verification Tests

### Test eBPF Agent

```bash
# Start agent
./agent-ebpf/bin/chainbench-agent --port 9090 &

# Check status
curl http://localhost:9090/status

# Check metrics
curl http://localhost:9090/metrics | grep chainbench

# Stop agent
pkill chainbench-agent
```

### Test UI

```bash
cd ui-business
npm run dev
# Open http://localhost:5173
# Drag & drop examples/report-example.json
```

### Test Observability Stack

```bash
# Check Prometheus targets
curl http://localhost:9091/api/v1/targets

# Access Grafana
# http://localhost:3000
# Login: admin/admin
# Navigate to Dashboards → ChainBench Performance Dashboard
```

## Next Steps

After installation:
1. Read [Usage Guide](usage.md)
2. Review [Mental Model](mental-model.md)
3. Run example benchmark
4. Generate your first report

## Uninstallation

```bash
# Stop services
docker-compose down -v

# Remove virtual environment
deactivate
rm -rf venv

# Remove node modules
cd ui-business && rm -rf node_modules

# Remove Go binaries
rm -rf agent-ebpf/bin
```
