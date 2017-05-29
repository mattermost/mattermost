// +build go1.8

package handlers

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoggingHandlerWithPush(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if _, ok := w.(http.Pusher); !ok {
			t.Fatalf("%T from LoggingHandler does not satisfy http.Pusher interface when built with Go >=1.8", w)
		}
		w.WriteHeader(200)
	})

	logger := LoggingHandler(ioutil.Discard, handler)
	logger.ServeHTTP(httptest.NewRecorder(), newRequest("GET", "/"))
}

func TestCombinedLoggingHandlerWithPush(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if _, ok := w.(http.Pusher); !ok {
			t.Fatalf("%T from CombinedLoggingHandler does not satisfy http.Pusher interface when built with Go >=1.8", w)
		}
		w.WriteHeader(200)
	})

	logger := CombinedLoggingHandler(ioutil.Discard, handler)
	logger.ServeHTTP(httptest.NewRecorder(), newRequest("GET", "/"))
}
