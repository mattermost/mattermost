
# NOTE: This Makefile is only necessary if you 
# plan on developing the msgp tool and library.
# Installation can still be performed with a
# normal `go install`.

# generated integration test files
GGEN = ./_generated/generated.go ./_generated/generated_test.go
# generated unit test files
MGEN = ./msgp/defgen_test.go

SHELL := /bin/bash

BIN = $(GOBIN)/msgp

.PHONY: clean wipe install get-deps bench all

$(BIN): */*.go
	@go install ./...

install: $(BIN)

$(GGEN): ./_generated/def.go
	go generate ./_generated

$(MGEN): ./msgp/defs_test.go
	go generate ./msgp

test: all
	go test ./... ./_generated

bench: all
	go test -bench ./...

clean:
	$(RM) $(GGEN) $(MGEN)

wipe: clean
	$(RM) $(BIN)

get-deps:
	go get -d -t ./...

all: install $(GGEN) $(MGEN)

# travis CI enters here
travis:
	go get -d -t ./...
	go build -o "$${GOPATH%%:*}/bin/msgp" .
	go generate ./msgp
	go generate ./_generated
	go test -v ./... ./_generated
