.PHONY: help install build start stop clean test

help:
	@echo "ChainBench - Performance Analysis Platform"
	@echo ""
	@echo "Available targets:"
	@echo "  install    - Install all dependencies"
	@echo "  build      - Build all components"
	@echo "  start      - Start all services"
	@echo "  stop       - Stop all services"
	@echo "  clean      - Clean build artifacts"
	@echo "  test       - Run tests"
	@echo "  example    - Run example benchmark"

install:
	@echo "Installing Python dependencies..."
	pip install -r requirements.txt
	@echo "Installing UI dependencies..."
	cd ui-business && npm install
	@echo "Installing Go dependencies..."
	cd agent-ebpf && go mod download
	@echo "✓ Installation complete"

build:
	@echo "Building eBPF agent..."
	cd agent-ebpf && go build -o bin/chainbench-agent
	@echo "Building UI..."
	cd ui-business && npm run build
	@echo "✓ Build complete"

start:
	@echo "Starting observability stack..."
	docker-compose up -d
	@echo "Starting eBPF agent..."
	./agent-ebpf/bin/chainbench-agent --port 9090 &
	@echo "Starting UI..."
	cd ui-business && npm run dev &
	@echo "✓ Services started"
	@echo ""
	@echo "Access:"
	@echo "  UI:         http://localhost:5173"
	@echo "  Grafana:    http://localhost:3000 (admin/admin)"
	@echo "  Prometheus: http://localhost:9091"
	@echo "  Agent:      http://localhost:9090"

stop:
	@echo "Stopping services..."
	docker-compose down
	pkill -f chainbench-agent || true
	pkill -f "vite" || true
	@echo "✓ Services stopped"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf agent-ebpf/bin
	rm -rf ui-business/dist
	rm -rf ui-business/node_modules
	rm -rf report.json
	rm -rf runner/results.csv runner/summary.json
	@echo "✓ Clean complete"

test:
	@echo "Running tests..."
	@echo "Testing eBPF agent..."
	./agent-ebpf/bin/chainbench-agent --help > /dev/null && echo "✓ Agent OK"
	@echo "Testing UI build..."
	cd ui-business && npm run build > /dev/null && echo "✓ UI OK"
	@echo "Testing report builder..."
	python3 report-builder/build_report.py --help > /dev/null && echo "✓ Report builder OK"
	@echo "✓ All tests passed"

example:
	@echo "Running example benchmark..."
	@echo "1. Loading example report in UI..."
	cd ui-business && npm run dev &
	@sleep 3
	@echo "2. Open http://localhost:5173"
	@echo "3. Drag & drop examples/report-example.json"
	@echo ""
	@echo "To run a real benchmark:"
	@echo "  make start"
	@echo "  python3 data/generate_data.py --N 2000 --M 15 --D 96 --seed 42"
	@echo "  python3 runner/run_all.py --metadata data/metadata.json --impls python-naive,python-numpy"
	@echo "  python3 report-builder/build_report.py --runner-summary runner/summary.json --metadata data/metadata.json"
