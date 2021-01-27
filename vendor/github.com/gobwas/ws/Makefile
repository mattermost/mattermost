BENCH     ?=.
BENCH_BASE?=master

clean:
	rm -f bin/reporter
	rm -fr autobahn/report/*

bin/reporter:
	go build -o bin/reporter ./autobahn

bin/gocovmerge:
	go build -o bin/gocovmerge github.com/wadey/gocovmerge

.PHONY: autobahn
autobahn: clean bin/reporter 
	./autobahn/script/test.sh --build --follow-logs
	bin/reporter $(PWD)/autobahn/report/index.json

.PHONY: autobahn/report
autobahn/report: bin/reporter
	./bin/reporter -http localhost:5555 ./autobahn/report/index.json

test:
	go test -coverprofile=ws.coverage .
	go test -coverprofile=wsutil.coverage ./wsutil
	go test -coverprofile=wsfalte.coverage ./wsflate
	# No statemenets to cover in ./tests (there are only tests).
	go test ./tests

cover: bin/gocovmerge test autobahn
	bin/gocovmerge ws.coverage wsutil.coverage wsflate.coverage autobahn/report/server.coverage > total.coverage

benchcmp: BENCH_BRANCH=$(shell git rev-parse --abbrev-ref HEAD)
benchcmp: BENCH_OLD:=$(shell mktemp -t old.XXXX)
benchcmp: BENCH_NEW:=$(shell mktemp -t new.XXXX)
benchcmp:
	if [ ! -z "$(shell git status -s)" ]; then\
		echo "could not compare with $(BENCH_BASE) – found unstaged changes";\
		exit 1;\
	fi;\
	if [ "$(BENCH_BRANCH)" == "$(BENCH_BASE)" ]; then\
		echo "comparing the same branches";\
		exit 1;\
	fi;\
	echo "benchmarking $(BENCH_BRANCH)...";\
	go test -run=none -bench=$(BENCH) -benchmem > $(BENCH_NEW);\
	echo "benchmarking $(BENCH_BASE)...";\
	git checkout -q $(BENCH_BASE);\
	go test -run=none -bench=$(BENCH) -benchmem > $(BENCH_OLD);\
	git checkout -q $(BENCH_BRANCH);\
	echo "\nresults:";\
	echo "========\n";\
	benchcmp $(BENCH_OLD) $(BENCH_NEW);\

