package elb_test

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"testing"
	"time"

	. "gopkg.in/check.v1"
)

func Test(t *testing.T) {
	TestingT(t)
}

type HTTPSuite struct{}

var testServer = NewTestHTTPServer("http://localhost:4444", 5*time.Second)

func (s *HTTPSuite) SetUpSuite(c *C) {
	testServer.Start()
}

func (s *HTTPSuite) TearDownTest(c *C) {
	testServer.FlushRequests()
}

type TestHTTPServer struct {
	URL      string
	Timeout  time.Duration
	started  bool
	request  chan *http.Request
	response chan *testResponse
	pending  chan bool
}

type testResponse struct {
	Status  int
	Headers map[string]string
	Body    string
}

func NewTestHTTPServer(url string, timeout time.Duration) *TestHTTPServer {
	return &TestHTTPServer{URL: url, Timeout: timeout}
}

func (s *TestHTTPServer) Start() {
	if s.started {
		return
	}
	s.started = true

	s.request = make(chan *http.Request, 64)
	s.response = make(chan *testResponse, 64)
	s.pending = make(chan bool, 64)

	url, _ := url.Parse(s.URL)
	go http.ListenAndServe(url.Host, s)

	s.PrepareResponse(202, nil, "Nothing.")
	for {
		// Wait for it to be up.
		resp, err := http.Get(s.URL)
		if err == nil && resp.StatusCode == 202 {
			break
		}
		time.Sleep(1e8)
	}
	s.WaitRequest() // Consume dummy request.
}

// FlushRequests discards requests which were not yet consumed by WaitRequest.
func (s *TestHTTPServer) FlushRequests() {
	for {
		select {
		case <-s.request:
		default:
			return
		}
	}
}

func (s *TestHTTPServer) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	s.request <- req
	var resp *testResponse
	select {
	case resp = <-s.response:
	case <-time.After(s.Timeout):
		fmt.Fprintf(os.Stderr, "ERROR: Timeout waiting for test to provide response\n")
		resp = &testResponse{500, nil, ""}
	}
	if resp.Headers != nil {
		h := w.Header()
		for k, v := range resp.Headers {
			h.Set(k, v)
		}
	}
	if resp.Status != 0 {
		w.WriteHeader(resp.Status)
	}
	w.Write([]byte(resp.Body))
}

func (s *TestHTTPServer) WaitRequest() *http.Request {
	select {
	case req := <-s.request:
		req.ParseForm()
		return req
	case <-time.After(s.Timeout):
		panic("Timeout waiting for goamz request")
	}
	panic("unreached")
}

func (s *TestHTTPServer) PrepareResponse(status int, headers map[string]string, body string) {
	s.response <- &testResponse{status, headers, body}
}
