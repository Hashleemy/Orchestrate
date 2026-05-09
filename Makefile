.PHONY: build ui go run dev clean check test

build: ui go

ui:
	cd web && npm install && npm run build

go:
	go build -o orchestrator.exe ./cmd/orchestrator

run: build
	./orchestrator.exe

dev:
	@echo "Start two terminals:"
	@echo "  1. cd web && npm run watch"
	@echo "  2. go run ./cmd/orchestrator"

check: test
	go vet ./...

test:
	go test -timeout 120s ./...

clean:
	rm -f orchestrator.exe
	rm -rf web/node_modules
	rm -rf internal/uiembed/dist/*.js internal/uiembed/dist/*.css
