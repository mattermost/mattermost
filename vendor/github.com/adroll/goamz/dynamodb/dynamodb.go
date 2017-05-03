package dynamodb

import simplejson "github.com/bitly/go-simplejson"
import (
	"bytes"
	"errors"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/AdRoll/goamz/aws"
)

type Server struct {
	Auth        aws.Auth
	Region      aws.Region
	RetryPolicy aws.RetryPolicy
}

func New(auth aws.Auth, region aws.Region) *Server {
	return &Server{auth, region, aws.DynamoDBRetryPolicy{}}
}

// Specific error constants
var ErrNotFound = errors.New("Item not found")
var ErrNotProcessed = errors.New("Key was not processed in the batch request, should retry")

// Error represents an error in an operation with Dynamodb (following goamz/s3)
type Error struct {
	StatusCode int // HTTP status code (200, 403, ...)
	Status     string
	Code       string // Dynamodb error code ("MalformedQueryString", ...)
	Message    string // The human-oriented error message
}

func (e Error) Error() string {
	if e.Message != "" {
		return e.Code + ": " + e.Message
	}
	return e.Code
}

func (e Error) ErrorCode() string {
	return e.Code
}

func buildError(r *http.Response, jsonBody []byte) error {

	ddbError := Error{
		StatusCode: r.StatusCode,
		Status:     r.Status,
	}

	json, err := simplejson.NewJson(jsonBody)
	if err != nil {
		return err
	}
	message := json.Get("Message").MustString()
	if message == "" {
		message = json.Get("message").MustString()
	}
	ddbError.Message = message

	// Of the form: com.amazon.coral.validate#ValidationException
	// We only want the last part
	codeStr := json.Get("__type").MustString()
	hashIndex := strings.Index(codeStr, "#")
	if hashIndex > 0 {
		codeStr = codeStr[hashIndex+1:]
	}
	ddbError.Code = codeStr

	return &ddbError
}

func (s *Server) queryServer(target string, query Query) ([]byte, error) {
	numRetries := 0
	for {
		qs, err := query.Marshal()
		if err != nil {
			return nil, err
		}
		data := bytes.NewReader(qs)

		hreq, err := http.NewRequest("POST", s.Region.DynamoDBEndpoint+"/", data)
		if err != nil {
			return nil, err
		}

		hreq.Header.Set("Content-Type", "application/x-amz-json-1.0")
		hreq.Header.Set("X-Amz-Date", time.Now().UTC().Format(aws.ISO8601BasicFormat))
		hreq.Header.Set("X-Amz-Target", target)

		token := s.Auth.Token()
		if token != "" {
			hreq.Header.Set("X-Amz-Security-Token", token)
		}

		signer := aws.NewV4Signer(s.Auth, "dynamodb", s.Region)
		signer.Sign(hreq)

		resp, err := http.DefaultClient.Do(hreq)
		if err != nil {
			if s.RetryPolicy.ShouldRetry(target, resp, err, numRetries) {
				time.Sleep(s.RetryPolicy.Delay(target, resp, err, numRetries))
				numRetries++
				continue
			}
			return nil, err
		}

		defer resp.Body.Close()

		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			if s.RetryPolicy.ShouldRetry(target, resp, err, numRetries) {
				time.Sleep(s.RetryPolicy.Delay(target, resp, err, numRetries))
				numRetries++
				continue
			}
			return nil, err
		}

		// http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ErrorHandling.html
		// "A response code of 200 indicates the operation was successful."
		if resp.StatusCode != 200 {
			err := buildError(resp, body)
			if s.RetryPolicy.ShouldRetry(target, resp, err, numRetries) {
				time.Sleep(s.RetryPolicy.Delay(target, resp, err, numRetries))
				numRetries++
				continue
			}
			return nil, err
		}

		return body, nil
	}
}

func target(name string) string {
	return "DynamoDB_20120810." + name
}
