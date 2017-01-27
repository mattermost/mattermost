package handlers

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecoveryLoggerWithDefaultOptions(t *testing.T) {
	var buf bytes.Buffer
	log.SetOutput(&buf)

	handler := RecoveryHandler()
	handlerFunc := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		panic("Unexpected error!")
	})

	recovery := handler(handlerFunc)
	recovery.ServeHTTP(httptest.NewRecorder(), newRequest("GET", "/subdir/asdf"))

	if !strings.Contains(buf.String(), "Unexpected error!") {
		t.Fatalf("Got log %#v, wanted substring %#v", buf.String(), "Unexpected error!")
	}
}

func TestRecoveryLoggerWithCustomLogger(t *testing.T) {
	var buf bytes.Buffer
	var logger = log.New(&buf, "", log.LstdFlags)

	handler := RecoveryHandler(RecoveryLogger(logger), PrintRecoveryStack(false))
	handlerFunc := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		panic("Unexpected error!")
	})

	recovery := handler(handlerFunc)
	recovery.ServeHTTP(httptest.NewRecorder(), newRequest("GET", "/subdir/asdf"))

	if !strings.Contains(buf.String(), "Unexpected error!") {
		t.Fatalf("Got log %#v, wanted substring %#v", buf.String(), "Unexpected error!")
	}
}
