package rpcplugin

import (
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func testHTTPResponseWriterRPC(w http.ResponseWriter, f func(w http.ResponseWriter)) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	c1 := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer c1.Close()

	c2 := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer c2.Close()

	id, server := c1.Serve()
	go ServeHTTPResponseWriter(w, server)

	remote := ConnectHTTPResponseWriter(c2.Connect(id))
	defer remote.Close()

	f(remote)
}

func TestHTTP(t *testing.T) {
	w := httptest.NewRecorder()

	testHTTPResponseWriterRPC(w, func(w http.ResponseWriter) {
		headers := w.Header()
		headers.Set("Test-Header-A", "a")
		headers.Set("Test-Header-B", "b")
		w.Header().Set("Test-Header-C", "c")
		w.WriteHeader(http.StatusPaymentRequired)
		n, err := w.Write([]byte("this is "))
		assert.Equal(t, 8, n)
		assert.NoError(t, err)
		n, err = w.Write([]byte("a test"))
		assert.Equal(t, 6, n)
		assert.NoError(t, err)
	})

	r := w.Result()
	defer r.Body.Close()

	assert.Equal(t, http.StatusPaymentRequired, r.StatusCode)

	body, err := ioutil.ReadAll(r.Body)
	assert.NoError(t, err)
	assert.EqualValues(t, "this is a test", body)

	assert.Equal(t, "a", r.Header.Get("Test-Header-A"))
	assert.Equal(t, "b", r.Header.Get("Test-Header-B"))
	assert.Equal(t, "c", r.Header.Get("Test-Header-C"))
}
