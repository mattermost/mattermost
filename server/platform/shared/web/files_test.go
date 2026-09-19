// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestWriteFileResponseContentLengthHeaders(t *testing.T) {
	body := "some file contents"

	for mode, compressed := range map[string]bool{
		"brotli":   true,
		"gzip":     true,
		"nogzip":   false,
		"disabled": false,
	} {
		t.Run(mode, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "/file", nil)

			WriteFileResponse("f.txt", "text/plain", int64(len(body)), time.Unix(0, 0), mode, strings.NewReader(body), false, w, r)

			size := strconv.Itoa(len(body))
			if compressed {
				assert.Equal(t, size, w.Header().Get("X-Uncompressed-Content-Length"))
			} else {
				assert.Empty(t, w.Header().Get("X-Uncompressed-Content-Length"))
				assert.Equal(t, size, w.Header().Get("Content-Length"))
			}
		})
	}
}
