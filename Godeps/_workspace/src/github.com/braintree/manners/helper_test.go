package manners

import (
	"net/http"
	"time"
)

// A response handler that blocks until it receives a signal; simulates an
// arbitrarily long web request. The "ready" channel is to prevent a race
// condition in the test where the test moves on before the server is ready
// to handle the request.
func newBlockingHandler(ready, done chan bool) *blockingHandler {
	return &blockingHandler{ready, done}
}

type blockingHandler struct {
	ready chan bool
	done  chan bool
}

func (h *blockingHandler) ServeHTTP(resp http.ResponseWriter, req *http.Request) {
	h.ready <- true
	time.Sleep(1e2)
	h.done <- true
}

// A response handler that does nothing.
func newTestHandler() testHandler {
	return testHandler{}
}

type testHandler struct{}

func (h testHandler) ServeHTTP(resp http.ResponseWriter, req *http.Request) {}
