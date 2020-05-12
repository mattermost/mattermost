// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

var tests = []struct {
	requestURL            string
	requestContentType    string
	requestAcceptEncoding []string
	expectBrotli          bool
}{
	{"http://test.com/foo.js", "application/javascript", []string{"br"}, true},
	{"http://test.com/foo.css", "text/css", []string{"br"}, true},
	{"http://test.com/foo.jss", "text/plain; charset=utf-8", []string{"gzip"}, false},
	{"http://test.com/foo.css", "text/plain; charset=utf-8", []string{"gzip"}, false},
	{"http://test.com/foo.jsx", "text/plain; charset=utf-8", []string{"br"}, false},
	{"http://test.com/foo.xcss", "text/plain; charset=utf-8", []string{"gzip"}, false},
}

type mockHandler struct{}

func (mh mockHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "hello")
}

func TestBrotliFilesHandler(t *testing.T) {
	for _, tt := range tests {
		t.Run(fmt.Sprintf("%v", tt), func(t *testing.T) {

			req := httptest.NewRequest("GET", tt.requestURL, nil)
			req.Header.Set("Accept-Encoding", strings.Join(tt.requestAcceptEncoding, ", "))
			w := httptest.NewRecorder()

			handler := brotliFilesHandler(mockHandler{})
			handler.ServeHTTP(w, req)

			resp := w.Result()

			require.Equal(t, tt.expectBrotli, resp.Header.Get("Content-Encoding") == "br")
			if tt.expectBrotli {
				require.Equal(t, tt.requestURL+".br", req.URL.String())
			} else {
				require.Equal(t, tt.requestURL, req.URL.String())
			}
			require.Equal(t, tt.requestContentType, resp.Header.Get("Content-Type"))
		})
	}
}
