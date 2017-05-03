package dynamodb

import (
	"encoding/json"
	"gopkg.in/check.v1"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/AdRoll/goamz/aws"
)

type RetrySuite struct {
	NumCallsToFail    int
	ExpectError       bool
	ErrorType         string
	ErrorStatusCode   int
	TableDescriptionT TableDescriptionT
	DynamoDBTest
}

func (s *RetrySuite) SetUpSuite(c *check.C) {
	setUpAuth(c)
	s.TableDescriptionT = TableDescriptionT{
		TableName: "DynamoDBTestMyTable",
		AttributeDefinitions: []AttributeDefinitionT{
			AttributeDefinitionT{"TestHashKey", "S"},
		},
		KeySchema: []KeySchemaT{
			KeySchemaT{"TestHashKey", "HASH"},
		},
		ProvisionedThroughput: ProvisionedThroughputT{
			ReadCapacityUnits:  1,
			WriteCapacityUnits: 1,
		},
	}
	s.DynamoDBTest.TableDescriptionT = s.TableDescriptionT
	s.server = New(dynamodb_auth, dynamodb_region)
	pk, err := s.TableDescriptionT.BuildPrimaryKey()
	if err != nil {
		c.Skip(err.Error())
	}
	s.table = s.server.NewTable(s.TableDescriptionT.TableName, pk)

	// Cleanup
	s.TearDownSuite(c)
	_, err = s.server.CreateTable(s.TableDescriptionT)
	if err != nil {
		c.Fatal(err)
	}
	s.WaitUntilStatus(c, "ACTIVE")
}

// Expect to succeed after a throttling exception.
var retry_suite_1 = &RetrySuite{
	NumCallsToFail:  1,
	ExpectError:     false,
	ErrorType:       "com.amazonaws.dynamodb.v20120810#ProvisionedThroughputExceededException",
	ErrorStatusCode: 400,
}

// Expect to succeed after 2 500 responses.
var retry_suite_2 = &RetrySuite{
	NumCallsToFail:  2,
	ExpectError:     false,
	ErrorType:       "not a reason to retry",
	ErrorStatusCode: 500,
}

// Expect to fail after exceeding max retries.
var retry_suite_3 = &RetrySuite{
	NumCallsToFail:  3,
	ExpectError:     true, // retry twice
	ErrorType:       "not a reason to retry",
	ErrorStatusCode: 500,
}

// Expect to fail due to not having a reason to retry.
var retry_suite_4 = &RetrySuite{
	NumCallsToFail:  1,
	ExpectError:     true,
	ErrorType:       "not a reason to retry",
	ErrorStatusCode: 400,
}

var _ = check.Suite(retry_suite_1)
var _ = check.Suite(retry_suite_2)
var _ = check.Suite(retry_suite_3)
var _ = check.Suite(retry_suite_4)

type retryPolicy struct {
	numCalls int
}

func (w *retryPolicy) ShouldRetry(target string, r *http.Response, err error, numRetries int) bool {
	w.numCalls++
	dynamodbPolicy := aws.DynamoDBRetryPolicy{}
	if !dynamodbPolicy.ShouldRetry(target, r, err, numRetries) {
		return false
	}
	return w.numCalls < 3
}

func (w *retryPolicy) Delay(target string, r *http.Response, err error, numRetries int) time.Duration {
	return 0
}

func (s *RetrySuite) TestRetryPolicy(c *check.C) {
	// Save off the real endpoint, and then point it at a local proxy.
	endpoint := s.table.Server.Region.DynamoDBEndpoint
	policy := s.table.Server.RetryPolicy
	defer func() {
		s.table.Server.Region.DynamoDBEndpoint = endpoint
		s.table.Server.RetryPolicy = policy
	}()
	numCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		numCalls++
		// Fake a failure the requested amount of times.
		if numCalls <= s.NumCallsToFail {
			b, _ := json.Marshal(map[string]interface{}{
				"__type": s.ErrorType,
				"Code":   "blah",
			})
			w.WriteHeader(s.ErrorStatusCode)
			io.WriteString(w, string(b))
			return
		}

		// Otherwise, proxy to actual DynamoDB endpoint. We reformat the request
		// with the same content.
		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			c.Fatal(err)
		}
		newr, err := http.NewRequest("POST", endpoint+"/", strings.NewReader(string(body)))
		headersToKeep := map[string]bool{
			"Content-Type":         true,
			"X-Amz-Date":           true,
			"X-Amz-Target":         true,
			"X-Amz-Security-Token": true,
		}
		for h, _ := range r.Header {
			if _, ok := headersToKeep[h]; ok {
				newr.Header.Set(h, r.Header.Get(h))
			}
		}

		signer := aws.NewV4Signer(s.table.Server.Auth, "dynamodb", s.table.Server.Region)
		signer.Sign(newr)

		resp, err := http.DefaultClient.Do(newr)
		if err != nil {
			c.Fatal(err)
		}
		body, err = ioutil.ReadAll(resp.Body)
		defer resp.Body.Close()
		if err != nil {
			c.Fatal(err)
		}
		w.WriteHeader(resp.StatusCode)
		io.WriteString(w, string(body))
	}))
	defer server.Close()
	rp := &retryPolicy{}
	s.table.Server.RetryPolicy = rp
	s.table.Server.Region.DynamoDBEndpoint = server.URL

	// Now make the request.
	k := &Key{HashKey: "NewHashKeyVal"}
	in := map[string]interface{}{
		"Attr1": "Attr1Val",
		"Attr2": 12,
	}
	err := s.table.PutDocument(k, in)
	if s.ExpectError {
		if err == nil {
			c.Fatalf("Expected error")
		}
	} else {
		if err != nil {
			c.Fatal(err)
		}
	}
	if rp.numCalls != s.NumCallsToFail {
		c.Fatalf("Expected %d failed calls, saw %d", s.NumCallsToFail, rp.numCalls)
	}
}
