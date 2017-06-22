BIN:=sockaddr
SRCS:=$(shell find . -name '*.go' ! -path '*/vendor/*')

.DEFAULT_GOAL := dev

.PHONY: dev
dev: $(BIN)
	@install $(BIN) ${GOPATH}/bin/

$(BIN): $(SRCS)
	go build -o $@

.PHONY: clean
clean::
	rm -f $(BIN) bin/* regression/*.diff
	rmdir bin/ || true

.PHONY: install
install:: $(BIN)
	install sockaddr ${GOPATH}/bin/

.PHONY: test
test::	$(BIN)
	@$(MAKE) -C regression

.PHONY: world
world::
	mkdir -p bin
	gox -os="solaris darwin freebsd linux windows" -arch="386 amd64 arm" -output="bin/sockaddr_{{.OS}}_{{.Arch}}" .
