GOTESTFLAGS ?= -test.count=1

test-all: test-unit test-mymysql test-gomysql test-postgres test-sqlite

test-unit:
	echo "Running unit tests"
	ginkgo -r -race -randomizeAllSpecs -keepGoing -- -test.run TestGorp

test-mymysql:
	echo "Testing against mymysql"
	go test . $(GOTESTFLAGS) -dsn="tcp:localhost:3306*gorptest/gorptest/gorptest" -dialect="mysql"

test-gomysql:
	echo "Testing against gomysql"
	go test . $(GOTESTFLAGS) -dsn="gorptest:gorptest@tcp(localhost:3306)/gorptest" -dialect="gomysql"

test-postgres:
	echo "Testing against postgres"
	go test . $(GOTESTFLAGS) -dsn="host=localhost user=gorptest password=gorptest dbname=gorptest sslmode=disable" -dialect="postgres"

test-sqlite:
	echo "Testing against sqlite"
	go test . $(GOTESTFLAGS) -dsn="/tmp/gorptest.bin" -dialect="sqlite"
	rm -f /tmp/gorptest.bin