package aws

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type testData struct {
	Data string
}

func body(str string) io.ReadCloser {
	return ioutil.NopCloser(bytes.NewReader([]byte(str)))
}

func unmarshal(req *Request) {
	defer req.HTTPResponse.Body.Close()
	if req.Data != nil {
		json.NewDecoder(req.HTTPResponse.Body).Decode(req.Data)
	}
	return
}

func unmarshalError(req *Request) {
	bodyBytes, err := ioutil.ReadAll(req.HTTPResponse.Body)
	if err != nil {
		req.Error = err
		return
	}
	if len(bodyBytes) == 0 {
		req.Error = APIError{
			StatusCode: req.HTTPResponse.StatusCode,
			Message:    req.HTTPResponse.Status,
		}
		return
	}
	var jsonErr jsonErrorResponse
	if err := json.Unmarshal(bodyBytes, &jsonErr); err != nil {
		req.Error = err
		return
	}
	req.Error = APIError{
		StatusCode: req.HTTPResponse.StatusCode,
		Code:       jsonErr.Code,
		Message:    jsonErr.Message,
	}
}

type jsonErrorResponse struct {
	Code    string `json:"__type"`
	Message string `json:"message"`
}

func TestRequestRecoverRetry(t *testing.T) {
	reqNum := 0
	reqs := []http.Response{
		http.Response{StatusCode: 500, Body: body(`{"__type":"UnknownError","message":"An error occurred."}`)},
		http.Response{StatusCode: 500, Body: body(`{"__type":"UnknownError","message":"An error occurred."}`)},
		http.Response{StatusCode: 200, Body: body(`{"data":"valid"}`)},
	}

	s := NewService(&Config{MaxRetries: -1})
	s.Handlers.Unmarshal.PushBack(unmarshal)
	s.Handlers.UnmarshalError.PushBack(unmarshalError)
	s.Handlers.Send.Init() // mock sending
	s.Handlers.Send.PushBack(func(r *Request) {
		r.HTTPResponse = &reqs[reqNum]
		reqNum++
	})
	out := &testData{}
	r := NewRequest(s, &Operation{Name: "Operation"}, nil, out)
	err := r.Send()
	assert.Nil(t, err)
	assert.Equal(t, 2, int(r.RetryCount))
	assert.Equal(t, "valid", out.Data)
}

func TestRequestExhaustRetries(t *testing.T) {
	delays := []time.Duration{}
	sleepDelay = func(delay time.Duration) {
		delays = append(delays, delay)
	}

	reqNum := 0
	reqs := []http.Response{
		http.Response{StatusCode: 500, Body: body(`{"__type":"UnknownError","message":"An error occurred."}`)},
		http.Response{StatusCode: 500, Body: body(`{"__type":"UnknownError","message":"An error occurred."}`)},
		http.Response{StatusCode: 500, Body: body(`{"__type":"UnknownError","message":"An error occurred."}`)},
		http.Response{StatusCode: 500, Body: body(`{"__type":"UnknownError","message":"An error occurred."}`)},
	}

	s := NewService(&Config{MaxRetries: -1})
	s.Handlers.Unmarshal.PushBack(unmarshal)
	s.Handlers.UnmarshalError.PushBack(unmarshalError)
	s.Handlers.Send.Init() // mock sending
	s.Handlers.Send.PushBack(func(r *Request) {
		r.HTTPResponse = &reqs[reqNum]
		reqNum++
	})
	r := NewRequest(s, &Operation{Name: "Operation"}, nil, nil)
	err := r.Send()
	apiErr := Error(err)
	assert.NotNil(t, err)
	assert.NotNil(t, apiErr)
	assert.Equal(t, 500, apiErr.StatusCode)
	assert.Equal(t, "UnknownError", apiErr.Code)
	assert.Equal(t, "An error occurred.", apiErr.Message)
	assert.Equal(t, 3, int(r.RetryCount))
	assert.True(t, reflect.DeepEqual([]time.Duration{30 * time.Millisecond, 60 * time.Millisecond, 120 * time.Millisecond}, delays))
}
