// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// writeDocsFixture lays out a directory mirroring the real Docusaurus build
// output: trailingSlash:false emits flat "<path>.html" files for content pages
// and "<path>/index.html" only for the root and redirect stubs.
func writeDocsFixture(t *testing.T) string {
	t.Helper()

	staticDir := t.TempDir()
	docsDir := filepath.Join(staticDir, DocsDir)

	files := map[string]string{
		"index.html":                             "<html><body>docs root</body></html>",
		"administration-guide.html":              "<html><body>admin guide</body></html>",
		"administration-guide/manage/scale.html": "<html><body>deep page</body></html>",
		"assets/css/styles.abcd1234.css":         "body{color:red}",
		"manage/command-line-tools/index.html":   "<html><body>redirect stub</body></html>",
	}
	for name, body := range files {
		full := filepath.Join(docsDir, name)
		require.NoError(t, os.MkdirAll(filepath.Dir(full), 0700))
		require.NoError(t, os.WriteFile(full, []byte(body), 0600))
	}

	return staticDir
}

func doDocsRequest(t *testing.T, staticDir, target string) *httptest.ResponseRecorder {
	t.Helper()

	rec := httptest.NewRecorder()
	// "/" is what GetSubpathFromConfig returns for a root-path install.
	NewDocsHandler(staticDir, "/").ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

func TestDocsHandlerServesBundle(t *testing.T) {
	staticDir := writeDocsFixture(t)

	testCases := []struct {
		name         string
		target       string
		expectedCode int
		expectedBody string
	}{
		{
			name:         "flat content page",
			target:       "/_documentation/administration-guide.html",
			expectedCode: http.StatusOK,
			expectedBody: "admin guide",
		},
		{
			name:         "deep flat content page",
			target:       "/_documentation/administration-guide/manage/scale.html",
			expectedCode: http.StatusOK,
			expectedBody: "deep page",
		},
		{
			name:         "explicit index.html",
			target:       "/_documentation/index.html",
			expectedCode: http.StatusOK,
			expectedBody: "docs root",
		},
		{
			name:         "asset",
			target:       "/_documentation/assets/css/styles.abcd1234.css",
			expectedCode: http.StatusOK,
			expectedBody: "body{color:red}",
		},
		{
			name:         "redirect stub index",
			target:       "/_documentation/manage/command-line-tools/index.html",
			expectedCode: http.StatusOK,
			expectedBody: "redirect stub",
		},
		{
			name:         "missing file",
			target:       "/_documentation/nope.html",
			expectedCode: http.StatusNotFound,
		},
		{
			name:         "directory with no index is not listed",
			target:       "/_documentation/assets",
			expectedCode: http.StatusNotFound,
		},
		{
			name:         "traversal out of the bundle is contained",
			target:       "/_documentation/../../config/config.json",
			expectedCode: http.StatusNotFound,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doDocsRequest(t, staticDir, tc.target)
			require.Equal(t, tc.expectedCode, rec.Code)
			if tc.expectedBody != "" {
				require.Contains(t, rec.Body.String(), tc.expectedBody)
			}
		})
	}
}

// TestDocsHandlerCleanURLs documents the URL forms the Docusaurus build
// actually links to. These are the requests a reader's browser makes.
func TestDocsHandlerCleanURLs(t *testing.T) {
	staticDir := writeDocsFixture(t)

	testCases := []struct {
		name         string
		target       string
		expectedCode int
	}{
		{
			name:         "bundle root as linked by the server route",
			target:       "/_documentation/",
			expectedCode: http.StatusOK,
		},
		{
			name:         "extensionless page as emitted by trailingSlash false",
			target:       "/_documentation/administration-guide",
			expectedCode: http.StatusOK,
		},
		{
			name:         "extensionless deep page",
			target:       "/_documentation/administration-guide/manage/scale",
			expectedCode: http.StatusOK,
		},
		{
			name:         "legacy redirect stub, extensionless",
			target:       "/_documentation/manage/command-line-tools",
			expectedCode: http.StatusOK,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doDocsRequest(t, staticDir, tc.target)
			require.Equal(t, tc.expectedCode, rec.Code)
		})
	}
}

func TestDocsHandlerAbsentDirectory(t *testing.T) {
	staticDir := t.TempDir() // no documentation/ subdirectory

	for _, target := range []string{
		"/_documentation/index.html",
		"/_documentation/administration-guide.html",
	} {
		rec := doDocsRequest(t, staticDir, target)
		require.Equal(t, http.StatusNotFound, rec.Code, target)
	}
}

func TestDocsHandlerSecurityHeaders(t *testing.T) {
	staticDir := writeDocsFixture(t)

	rec := doDocsRequest(t, staticDir, "/_documentation/index.html")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))
	require.Equal(t, "no-referrer", rec.Header().Get("Referrer-Policy"))
	require.Equal(t, "max-age=31556926, public", rec.Header().Get("Cache-Control"))
	require.Contains(t, rec.Header().Get("Content-Type"), "text/html")
}
