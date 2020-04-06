// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bufio"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

type TestHandler struct {
	Wrapper  *ResponseWriterWrapper
	TestFunc func(w http.ResponseWriter, r *http.Request)
}

func (h *TestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.TestFunc(h.Wrapper, r)
}

func createTestHandler(wrapper *ResponseWriterWrapper, testFunc func(w http.ResponseWriter, r *http.Request)) http.Handler {
	return &TestHandler{
		Wrapper:  wrapper,
		TestFunc: testFunc,
	}
}

type ResposeRecorderHijack struct {
	httptest.ResponseRecorder
}

func (r *ResposeRecorderHijack) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	r.WriteHeader(http.StatusOK)
	return nil, nil, nil
}

func NewResponseWithHijack(original *httptest.ResponseRecorder) *ResposeRecorderHijack {
	return &ResposeRecorderHijack{*original}
}

func TestStatusCodeIsAccessible(t *testing.T) {
	resp := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	wrapper := BuildResponseWriter(resp)
	handler := createTestHandler(wrapper, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	})
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusBadRequest, wrapper.StatusCode())
}

func TestStatusCodeShouldBe200IfNotHeaderWritten(t *testing.T) {
	resp := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	wrapper := BuildResponseWriter(resp)
	handler := createTestHandler(wrapper, func(w http.ResponseWriter, r *http.Request) {
		wrapper.Write([]byte{})
	})
	handler.ServeHTTP(resp, req)
	assert.Equal(t, http.StatusOK, wrapper.StatusCode())
}

func TestForUnsupportedHijack(t *testing.T) {
	resp := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	wrapper := BuildResponseWriter(resp)
	handler := createTestHandler(wrapper, func(w http.ResponseWriter, r *http.Request) {
		_, _, err := wrapper.Hijack()
		assert.NotNil(t, err)
		assert.Equal(t, "Hijacker interface not supported by the wrapped ResponseWriter", err.Error())
	})
	handler.ServeHTTP(resp, req)
}

func TestForSupportedHijack(t *testing.T) {
	resp := NewResponseWithHijack(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/api/v4/test", nil)
	wrapper := BuildResponseWriter(resp)
	handler := createTestHandler(wrapper, func(w http.ResponseWriter, r *http.Request) {
		_, _, err := wrapper.Hijack()
		assert.Nil(t, err)
	})
	handler.ServeHTTP(resp, req)
}
