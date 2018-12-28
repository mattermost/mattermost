package utils

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLargeBufferHappy(t *testing.T) {
	for testName, tc := range map[string]struct {
		chunks                [][]byte
		expectedBufferedBytes []byte
		expectedFileBytes     []byte
		expectedReadBackBytes []byte
	}{
		"happy memory buffered": {
			chunks:                [][]byte{[]byte("123")},
			expectedBufferedBytes: []byte("123"),
			expectedReadBackBytes: []byte("123"),
		},
		"happy memory plus file": {
			chunks: [][]byte{
				[]byte("0123456789ABCDEF"),
				[]byte("XYZ"),
			},
			expectedBufferedBytes: []byte("0123456789ABCDEF"),
			expectedFileBytes:     []byte("=BSf"),
			expectedReadBackBytes: []byte("0123456789ABCDEFXYZ"),
		},
	} {
		testfunc := func(t *testing.T, lbuf *LargeBuffer) {
			a := assert.New(t)
			for _, chunk := range tc.chunks {
				n, err := lbuf.Write(chunk)
				a.Empty(err, "Expected no error")
				a.Equal(len(chunk), n, "Wrong n returned (bytes written)")
			}

			a.Equal(lbuf.buffer.Bytes(), tc.expectedBufferedBytes, "Buffered contents differs")

			err := lbuf.Close()
			a.Empty(err, "Expected no error")

			a.Empty(lbuf.writeFile)
			if len(tc.expectedFileBytes) > 0 {
				fileBytes, err := ioutil.ReadFile(lbuf.tempFileName)
				a.Empty(err, "Expected no error")
				a.Equalf(tc.expectedFileBytes, fileBytes, "File contents differs, actual: %q", string(fileBytes))
			}

			rc1, err := lbuf.NewReadCloser()
			a.Empty(err, "Expected no error")
			rc2, err := lbuf.NewReadCloser()
			a.Empty(err, "Expected no error")

			readBackBytes1, err := ioutil.ReadAll(rc1)
			a.Empty(err, "Expected no error")
			readBackBytes2, err := ioutil.ReadAll(rc2)
			a.Empty(err, "Expected no error")

			err = rc1.Close()
			a.Empty(err, "Expected no error")
			err = rc2.Close()
			a.Empty(err, "Expected no error")

			a.Equal(tc.expectedReadBackBytes, readBackBytes1, "Readback contents differs")
			a.Equal(tc.expectedReadBackBytes, readBackBytes2, "Readback contents differs")

			filename := lbuf.tempFileName
			if filename != "" {
				err = lbuf.Clear()
				a.Empty(err, "Expected no error")
				_, err = os.Stat(filename)
				a.Equalf(os.IsNotExist(err), true, "File %q should have been deleted", filename)
			}
		}

		lbuf := NewLargeBuffer(16, "ascii85")
		t.Run(testName, func(t *testing.T) {
			testfunc(t, lbuf)
		})
	}
}

func TestLimitedReader(t *testing.T) {
	t.Run("no callback", func(t *testing.T) {
		lr := &LimitedReader{R: bytes.NewReader([]byte("0123456789")), N: 10}

		to := make([]byte, 5)
		n, err := lr.Read(to)
		assert.Equal(t, 5, n)
		assert.Nil(t, err)

		to = make([]byte, 4)
		n, err = lr.Read(to)
		assert.Equal(t, 4, n)
		assert.Nil(t, err)

		to = make([]byte, 2)
		n, err = lr.Read(to)
		assert.Equal(t, 1, n)
		assert.Nil(t, err)

		to = make([]byte, 2)
		n, err = lr.Read(to)
		assert.Equal(t, 0, n)
		assert.Equal(t, io.EOF, err)
	})

	t.Run("no callback exact", func(t *testing.T) {
		lr := &LimitedReader{R: bytes.NewReader([]byte("0123456789")), N: 10}

		to := make([]byte, 5)
		n, err := lr.Read(to)
		assert.Equal(t, 5, n)
		assert.Nil(t, err)

		to = make([]byte, 5)
		n, err = lr.Read(to)
		assert.Equal(t, 5, n)
		assert.Nil(t, err)

		to = make([]byte, 1)
		n, err = lr.Read(to)
		assert.Equal(t, 0, n)
		assert.Equal(t, io.EOF, err)
	})

	t.Run("callback", func(t *testing.T) {
		exceeded := false
		exceededAfter := 0

		lr := &LimitedReader{
			R: bytes.NewReader([]byte("0123456789")),
			N: 10,
			LimitReached: func(l *LimitedReader) error {
				exceeded = true
				exceededAfter = int(l.BytesRead)
				return fmt.Errorf("something else")
			},
		}

		to := make([]byte, 12)
		n, err := lr.Read(to)
		assert.Equal(t, 10, n)
		assert.Nil(t, err)
		assert.False(t, exceeded)

		to = make([]byte, 1)
		n, err = lr.Read(to)
		require.NotNil(t, err)
		assert.Equal(t, "something else", err.Error())
		assert.True(t, exceeded)
		assert.Equal(t, 10, exceededAfter)
	})
}
