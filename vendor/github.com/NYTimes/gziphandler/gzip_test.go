package gziphandler

import (
	"bytes"
	"compress/gzip"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseEncodings(t *testing.T) {

	examples := map[string]codings{

		// Examples from RFC 2616
		"compress, gzip": codings{"compress": 1.0, "gzip": 1.0},
		"":               codings{},
		"*":              codings{"*": 1.0},
		"compress;q=0.5, gzip;q=1.0":         codings{"compress": 0.5, "gzip": 1.0},
		"gzip;q=1.0, identity; q=0.5, *;q=0": codings{"gzip": 1.0, "identity": 0.5, "*": 0.0},

		// More random stuff
		"AAA;q=1":     codings{"aaa": 1.0},
		"BBB ; q = 2": codings{"bbb": 1.0},
	}

	for eg, exp := range examples {
		act, _ := parseEncodings(eg)
		assert.Equal(t, exp, act)
	}
}

func TestGzipHandler(t *testing.T) {
	testBody := "aaabbbccc"

	// This just exists to provide something for GzipHandler to wrap.
	handler := newTestHandler(testBody)

	// requests without accept-encoding are passed along as-is

	req1, _ := http.NewRequest("GET", "/whatever", nil)
	res1 := httptest.NewRecorder()
	handler.ServeHTTP(res1, req1)

	assert.Equal(t, 200, res1.Code)
	assert.Equal(t, "", res1.Header().Get("Content-Encoding"))
	assert.Equal(t, "Accept-Encoding", res1.Header().Get("Vary"))
	assert.Equal(t, testBody, res1.Body.String())

	// but requests with accept-encoding:gzip are compressed if possible

	req2, _ := http.NewRequest("GET", "/whatever", nil)
	req2.Header.Set("Accept-Encoding", "gzip")
	res2 := httptest.NewRecorder()
	handler.ServeHTTP(res2, req2)

	assert.Equal(t, 200, res2.Code)
	assert.Equal(t, "gzip", res2.Header().Get("Content-Encoding"))
	assert.Equal(t, "Accept-Encoding", res2.Header().Get("Vary"))
	assert.Equal(t, gzipStr(testBody), res2.Body.Bytes())

	// content-type header is correctly set based on uncompressed body

	req3, _ := http.NewRequest("GET", "/whatever", nil)
	req3.Header.Set("Accept-Encoding", "gzip")
	res3 := httptest.NewRecorder()
	handler.ServeHTTP(res3, req3)

	assert.Equal(t, http.DetectContentType([]byte(testBody)), res3.Header().Get("Content-Type"))
}

// --------------------------------------------------------------------

func BenchmarkGzipHandler_S2k(b *testing.B)   { benchmark(b, false, 2048) }
func BenchmarkGzipHandler_S20k(b *testing.B)  { benchmark(b, false, 20480) }
func BenchmarkGzipHandler_S100k(b *testing.B) { benchmark(b, false, 102400) }
func BenchmarkGzipHandler_P2k(b *testing.B)   { benchmark(b, true, 2048) }
func BenchmarkGzipHandler_P20k(b *testing.B)  { benchmark(b, true, 20480) }
func BenchmarkGzipHandler_P100k(b *testing.B) { benchmark(b, true, 102400) }

// --------------------------------------------------------------------

func gzipStr(s string) []byte {
	var b bytes.Buffer
	w := gzip.NewWriter(&b)
	io.WriteString(w, s)
	w.Close()
	return b.Bytes()
}

func benchmark(b *testing.B, parallel bool, size int) {
	bin, err := ioutil.ReadFile("testdata/benchmark.json")
	if err != nil {
		b.Fatal(err)
	}

	req, _ := http.NewRequest("GET", "/whatever", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	handler := newTestHandler(string(bin[:size]))

	if parallel {
		b.ResetTimer()
		b.RunParallel(func(pb *testing.PB) {
			for pb.Next() {
				runBenchmark(b, req, handler)
			}
		})
	} else {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			runBenchmark(b, req, handler)
		}
	}
}

func runBenchmark(b *testing.B, req *http.Request, handler http.Handler) {
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if code := res.Code; code != 200 {
		b.Fatalf("Expected 200 but got %d", code)
	} else if blen := res.Body.Len(); blen < 500 {
		b.Fatalf("Expected complete response body, but got %d bytes", blen)
	}
}

func newTestHandler(body string) http.Handler {
	return GzipHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, body)
	}))
}
