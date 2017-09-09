package rpcplugin

import (
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewAsyncReadCloser(t *testing.T) {
	rf, w, err := os.Pipe()
	require.NoError(t, err)
	r := NewAsyncReadCloser(rf)
	defer r.Close()

	go func() {
		w.Write([]byte("foo"))
		w.Close()
	}()

	foo, err := ioutil.ReadAll(r)
	require.NoError(t, err)
	assert.Equal(t, "foo", string(foo))
}

func TestNewAsyncReadCloser_CloseDuringRead(t *testing.T) {
	rf, w, err := os.Pipe()
	require.NoError(t, err)
	defer w.Close()

	r := NewAsyncReadCloser(rf)

	go func() {
		time.Sleep(time.Millisecond * 200)
		r.Close()
	}()
	r.Read(make([]byte, 10))
}

func TestNewAsyncWriteCloser(t *testing.T) {
	r, wf, err := os.Pipe()
	require.NoError(t, err)
	w := NewAsyncWriteCloser(wf)
	defer w.Close()

	go func() {
		foo, err := ioutil.ReadAll(r)
		require.NoError(t, err)
		assert.Equal(t, "foo", string(foo))
		r.Close()
	}()

	n, err := w.Write([]byte("foo"))
	require.NoError(t, err)
	assert.Equal(t, 3, n)
}

func TestNewAsyncWriteCloser_CloseDuringWrite(t *testing.T) {
	r, wf, err := os.Pipe()
	require.NoError(t, err)
	defer r.Close()

	w := NewAsyncWriteCloser(wf)

	go func() {
		time.Sleep(time.Millisecond * 200)
		w.Close()
	}()
	w.Write(make([]byte, 10))
}
