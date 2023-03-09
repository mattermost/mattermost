// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

type PluginResponseWriter struct {
	bytes.Buffer
	headers    http.Header
	statusCode int
}

func (rt *PluginResponseWriter) Header() http.Header {
	if rt.headers == nil {
		rt.headers = make(http.Header)
	}
	return rt.headers
}

func (rt *PluginResponseWriter) WriteHeader(statusCode int) {
	rt.statusCode = statusCode
}

// From net/http/httptest/recorder.go
func parseContentLength(cl string) int64 {
	cl = strings.TrimSpace(cl)
	if cl == "" {
		return -1
	}
	n, err := strconv.ParseInt(cl, 10, 64)
	if err != nil {
		return -1
	}
	return n

}

func (rt *PluginResponseWriter) GenerateResponse() *http.Response {
	res := &http.Response{
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
		StatusCode: rt.statusCode,
		Header:     rt.headers.Clone(),
	}

	if res.StatusCode == 0 {
		res.StatusCode = http.StatusOK
	}

	res.Status = fmt.Sprintf("%03d %s", res.StatusCode, http.StatusText(res.StatusCode))

	if rt.Len() > 0 {
		res.Body = io.NopCloser(rt)
	} else {
		res.Body = http.NoBody
	}

	res.ContentLength = parseContentLength(rt.headers.Get("Content-Length"))

	return res
}
