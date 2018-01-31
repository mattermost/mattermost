/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2015-2017 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package s3signer

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"io"
	"io/ioutil"
	"net/http"
	"strings"
)

// N B minio-go should compile on go1.5.3 onwards and httptest package is
// available only from go.1.7.x. The following function is taken from
// Go httptest package to be able to build on older versions of Go.

// NewRequest returns a new incoming server Request, suitable
// for passing to an http.Handler for testing.
//
// The target is the RFC 7230 "request-target": it may be either a
// path or an absolute URL. If target is an absolute URL, the host name
// from the URL is used. Otherwise, "example.com" is used.
//
// The TLS field is set to a non-nil dummy value if target has scheme
// "https".
//
// The Request.Proto is always HTTP/1.1.
//
// An empty method means "GET".
//
// The provided body may be nil. If the body is of type *bytes.Reader,
// *strings.Reader, or *bytes.Buffer, the Request.ContentLength is
// set.
//
// NewRequest panics on error for ease of use in testing, where a
// panic is acceptable.
func NewRequest(method, target string, body io.Reader) *http.Request {
	if method == "" {
		method = "GET"
	}
	req, err := http.ReadRequest(bufio.NewReader(strings.NewReader(method + " " + target + " HTTP/1.0\r\n\r\n")))
	if err != nil {
		panic("invalid NewRequest arguments; " + err.Error())
	}

	// HTTP/1.0 was used above to avoid needing a Host field. Change it to 1.1 here.
	req.Proto = "HTTP/1.1"
	req.ProtoMinor = 1
	req.Close = false

	if body != nil {
		switch v := body.(type) {
		case *bytes.Buffer:
			req.ContentLength = int64(v.Len())
		case *bytes.Reader:
			req.ContentLength = int64(v.Len())
		case *strings.Reader:
			req.ContentLength = int64(v.Len())
		default:
			req.ContentLength = -1
		}
		if rc, ok := body.(io.ReadCloser); ok {
			req.Body = rc
		} else {
			req.Body = ioutil.NopCloser(body)
		}
	}

	// 192.0.2.0/24 is "TEST-NET" in RFC 5737 for use solely in
	// documentation and example source code and should not be
	// used publicly.
	req.RemoteAddr = "192.0.2.1:1234"

	if req.Host == "" {
		req.Host = "example.com"
	}

	if strings.HasPrefix(target, "https://") {
		req.TLS = &tls.ConnectionState{
			Version:           tls.VersionTLS12,
			HandshakeComplete: true,
			ServerName:        req.Host,
		}
	}

	return req
}
