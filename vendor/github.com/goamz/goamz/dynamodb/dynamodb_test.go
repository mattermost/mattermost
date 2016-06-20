package dynamodb_test

import (
	"flag"
	"testing"
	"time"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/dynamodb"
	. "gopkg.in/check.v1"
)

const TIMEOUT = 3 * time.Minute

var amazon = flag.Bool("amazon", false, "Enable tests against dynamodb")
var local = flag.Bool("local", true, "Use DynamoDB local on 8080 instead of real server on us-east.")

var dynamodb_region aws.Region
var dynamodb_auth aws.Auth

type DynamoDBTest struct {
	server            *dynamodb.Server
	aws.Region        // Exports Region
	TableDescriptionT dynamodb.TableDescriptionT
	table             *dynamodb.Table
}

// Delete all items in the table
func (s *DynamoDBTest) TearDownTest(c *C) {
	pk, err := s.TableDescriptionT.BuildPrimaryKey()
	if err != nil {
		c.Fatal(err)
	}

	attrs, err := s.table.Scan(nil)
	if err != nil {
		c.Fatal(err)
	}
	for _, a := range attrs {
		key := &dynamodb.Key{
			HashKey: a[pk.KeyAttribute.Name].Value,
		}
		if pk.HasRange() {
			key.RangeKey = a[pk.RangeAttribute.Name].Value
		}
		if ok, err := s.table.DeleteItem(key); !ok {
			c.Fatal(err)
		}
	}
}

func (s *DynamoDBTest) TearDownSuite(c *C) {
	// return immediately in the case of calling c.Skip() in SetUpSuite()
	if s.server == nil {
		return
	}

	// check whether the table exists
	if tables, err := s.server.ListTables(); err != nil {
		c.Fatal(err)
	} else {
		if !findTableByName(tables, s.TableDescriptionT.TableName) {
			return
		}
	}

	// Delete the table and wait
	if _, err := s.server.DeleteTable(s.TableDescriptionT); err != nil {
		c.Fatal(err)
	}

	done := make(chan bool)
	timeout := time.After(TIMEOUT)
	go func() {
		for {
			select {
			case <-done:
				return
			default:
				tables, err := s.server.ListTables()
				if err != nil {
					c.Fatal(err)
				}
				if findTableByName(tables, s.TableDescriptionT.TableName) {
					time.Sleep(5 * time.Second)
				} else {
					done <- true
					return
				}
			}
		}
	}()
	select {
	case <-done:
		break
	case <-timeout:
		c.Error("Expect the table to be deleted but timed out")
		close(done)
	}
}

func (s *DynamoDBTest) WaitUntilStatus(c *C, status string) {
	// We should wait until the table is in specified status because a real DynamoDB has some delay for ready
	done := make(chan bool)
	timeout := time.After(TIMEOUT)
	go func() {
		for {
			select {
			case <-done:
				return
			default:
				desc, err := s.table.DescribeTable()
				if err != nil {
					c.Fatal(err)
				}
				if desc.TableStatus == status {
					done <- true
					return
				}
				time.Sleep(5 * time.Second)
			}
		}
	}()
	select {
	case <-done:
		break
	case <-timeout:
		c.Errorf("Expect a status to be %s, but timed out", status)
		close(done)
	}
}

func setUpAuth(c *C) {
	if !*amazon {
		c.Skip("Test against amazon not enabled.")
	}
	if *local {
		c.Log("Using local server")
		dynamodb_region = aws.Region{
			DynamoDBEndpoint:        "http://127.0.0.1:8000",
			DynamoDBStreamsEndpoint: "http://127.0.0.1:8000",
		}
		dynamodb_auth = aws.Auth{AccessKey: "DUMMY_KEY", SecretKey: "DUMMY_SECRET"}
	} else {
		c.Log("Using REAL AMAZON SERVER")
		dynamodb_region = aws.USEast
		auth, err := aws.EnvAuth()
		if err != nil {
			c.Fatal(err)
		}
		dynamodb_auth = auth
	}
}

func findTableByName(tables []string, name string) bool {
	for _, t := range tables {
		if t == name {
			return true
		}
	}
	return false
}

func Test(t *testing.T) {
	TestingT(t)
}
