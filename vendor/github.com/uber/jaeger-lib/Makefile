PROJECT_ROOT=github.com/uber/jaeger-lib
PACKAGES := $(shell go list ./... | awk -F/ 'NR>1 {print "./"$$4"/..."}' | sort -u)
# all .go files that don't exist in hidden directories
ALL_SRC := $(shell find . -name "*.go" | grep -v -e vendor \
        -e ".*/\..*" \
        -e ".*/_.*" \
        -e ".*/mocks.*")

USE_DEP := true

RACE=-race
GOTEST=go test -v $(RACE)
GOLINT=golint
GOVET=go vet
GOFMT=gofmt
FMT_LOG=fmt.log
LINT_LOG=lint.log

PASS=$(shell printf "\033[32mPASS\033[0m")
FAIL=$(shell printf "\033[31mFAIL\033[0m")
COLORIZE=sed ''/PASS/s//$(PASS)/'' | sed ''/FAIL/s//$(FAIL)/''

.DEFAULT_GOAL := test-and-lint

.PHONY: test-and-lint
test-and-lint: test fmt lint

.PHONY: test
test:
ifeq ($(USE_DEP),true)
	dep check
endif
	$(GOTEST) $(PACKAGES) | $(COLORIZE)

.PHONY: fmt
fmt:
	$(GOFMT) -e -s -l -w $(ALL_SRC)
	./scripts/updateLicenses.sh

.PHONY: lint
lint:
	$(GOVET) ./...
	@cat /dev/null > $(LINT_LOG)
	@$(foreach pkg, $(PACKAGES), $(GOLINT) $(pkg) >> $(LINT_LOG) || true;)
	@[ ! -s "$(LINT_LOG)" ] || (echo "Lint Failures" | cat - $(LINT_LOG) && false)
	@$(GOFMT) -e -s -l $(ALL_SRC) > $(FMT_LOG)
	@./scripts/updateLicenses.sh >> $(FMT_LOG)
	@[ ! -s "$(FMT_LOG)" ] || (echo "go fmt or license check failures, run 'make fmt'" | cat - $(FMT_LOG) && false)


.PHONY: install
install:
ifeq ($(USE_DEP),true)
	dep version || make install-dep
	dep ensure
	dep status
else ifeq ($(USE_GLIDE),true)
	glide --version || go get github.com/Masterminds/glide
	glide install
endif

.PHONY: cover
cover:
	$(GOTEST) -cover -coverprofile cover.out ./...

.PHONY: cover-html
cover-html: cover
	go tool cover -html=cover.out -o cover.html


idl-submodule:
	git submodule init
	git submodule update

thrift-image:
	$(THRIFT) -version

.PHONY: install-dep
install-dep:
	- curl -L -s https://github.com/golang/dep/releases/download/v0.3.2/dep-linux-amd64 -o $$GOPATH/bin/dep
	- chmod +x $$GOPATH/bin/dep

.PHONY: install-ci
install-ci: install
	go get github.com/wadey/gocovmerge
	go get github.com/mattn/goveralls
	go get golang.org/x/tools/cmd/cover
	go get golang.org/x/lint/golint


.PHONY: test-ci
test-ci: cover lint

.PHONY: test-only-ci
test-only-ci:
	$(GOTEST) -cover ./...
	make lint
