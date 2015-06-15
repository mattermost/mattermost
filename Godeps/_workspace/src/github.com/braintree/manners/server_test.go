package manners

import (
	"net/http"
	"testing"
)

// Tests that the server allows in-flight requests to complete before shutting
// down.
func TestGracefulness(t *testing.T) {
	ready := make(chan bool)
	done := make(chan bool)

	exited := false

	handler := newBlockingHandler(ready, done)
	server := NewServer()

	go func() {
		err := server.ListenAndServe(":7000", handler)
		if err != nil {
			t.Error(err)
		}

		exited = true
	}()

	go func() {
		_, err := http.Get("http://localhost:7000")
		if err != nil {
			t.Error(err)
		}
	}()

	// This will block until the server is inside the handler function.
	<-ready

	server.Shutdown <- true
	<-done

	if exited {
		t.Fatal("The request did not complete before server exited")
	} else {
		// The handler is being allowed to run to completion; test passes.
	}
}

// Tests that the server begins to shut down when told to and does not accept
// new requests
func TestShutdown(t *testing.T) {
	handler := newTestHandler()
	server := NewServer()
	exited := make(chan bool)

	go func() {
		err := server.ListenAndServe(":7100", handler)
		if err != nil {
			t.Error(err)
		}
		exited <- true
	}()

	server.Shutdown <- true

	<-exited
	_, err := http.Get("http://localhost:7100")

	if err == nil {
		t.Fatal("Did not receive an error when trying to connect to server.")
	}
}
