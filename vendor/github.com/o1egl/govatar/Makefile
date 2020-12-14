PLATFORMS := linux/amd64 windows/amd64/.exe windows/386/.exe darwin/amd64

temp = $(subst /, ,$@)
os = $(word 1, $(temp))
arch = $(word 2, $(temp))
ext = $(word 3, $(temp))
VERSION := $(shell git describe --always --abbrev=6 --tags)

.PHONY: build

build: clean $(PLATFORMS);

clean:
	rm -rf build/

assets:
	find ./data ! -regex ".*\.png$$" -type f | xargs rm
	go-bindata -nomemcopy -nometadata -pkg bindata -o ./bindata/bindata.go data/...
	goimports -w bindata/bindata.go

$(PLATFORMS):
	GOOS=$(os) GOARCH=$(arch) go build -ldflags "-X main.version=${VERSION}" -o 'build/govatar$(ext)' ./govatar
	zip 'build/govatar-$(os)-$(arch).$(VERSION).zip' 'build/govatar$(ext)'
