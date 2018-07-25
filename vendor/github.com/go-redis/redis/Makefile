all: testdeps
	go test ./...
	go test ./... -short -race
	env GOOS=linux GOARCH=386 go test ./...
	go vet

testdeps: testdata/redis/src/redis-server

bench: testdeps
	go test ./... -test.run=NONE -test.bench=. -test.benchmem

.PHONY: all test testdeps bench

testdata/redis:
	mkdir -p $@
	wget -qO- https://github.com/antirez/redis/archive/unstable.tar.gz | tar xvz --strip-components=1 -C $@

testdata/redis/src/redis-server: testdata/redis
	sed -i.bak 's/libjemalloc.a/libjemalloc.a -lrt/g' $</src/Makefile
	cd $< && make all
