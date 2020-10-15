.PHONY: all
all: build test vet fmt lint

.PHONY: build
build:
	go build ./...

.PHONY: fmt
fmt:
	scripts/check_gofmt.sh

.PHONY: get-deps
get-deps:
	go get github.com/go-redis/redis
	go get github.com/gomodule/redigo/redis
	go get github.com/hashicorp/golang-lru
	go get golang.org/x/lint/golint

.PHONY: lint
lint:
	golint -set_exit_status ./...

.PHONY: test
test:
	go test ./...

.PHONY: vet
vet:
	go vet ./...
