package rpcplugin

import (
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMuxer(t *testing.T) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	alice := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer func() { assert.NoError(t, alice.Close()) }()

	bob := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer func() { assert.NoError(t, bob.Close()) }()

	id1, alice1 := alice.Serve()
	defer func() { assert.NoError(t, alice1.Close()) }()

	id2, bob2 := bob.Serve()
	defer func() { assert.NoError(t, bob2.Close()) }()

	done1 := make(chan bool)
	done2 := make(chan bool)

	go func() {
		bob1 := bob.Connect(id1)
		defer func() { assert.NoError(t, bob1.Close()) }()

		n, err := bob1.Write([]byte("ping1.0"))
		require.NoError(t, err)
		assert.Equal(t, n, 7)

		n, err = bob1.Write([]byte("ping1.1"))
		require.NoError(t, err)
		assert.Equal(t, n, 7)
	}()

	go func() {
		alice2 := alice.Connect(id2)
		defer func() { assert.NoError(t, alice2.Close()) }()

		n, err := alice2.Write([]byte("ping2.0"))
		require.NoError(t, err)
		assert.Equal(t, n, 7)

		buf := make([]byte, 20)
		n, err = alice2.Read(buf)
		require.NoError(t, err)
		assert.Equal(t, n, 7)
		assert.Equal(t, []byte("pong2.0"), buf[:n])

		done2 <- true
	}()

	go func() {
		buf := make([]byte, 7)
		n, err := io.ReadFull(alice1, buf)
		require.NoError(t, err)
		assert.Equal(t, n, 7)
		assert.Equal(t, []byte("ping1.0"), buf[:n])

		n, err = alice1.Read(buf)
		require.NoError(t, err)
		assert.Equal(t, n, 7)
		assert.Equal(t, []byte("ping1.1"), buf[:n])

		done1 <- true
	}()

	go func() {
		buf := make([]byte, 20)
		n, err := bob2.Read(buf)
		require.NoError(t, err)
		assert.Equal(t, n, 7)
		assert.Equal(t, []byte("ping2.0"), buf[:n])

		n, err = bob2.Write([]byte("pong2.0"))
		require.NoError(t, err)
		assert.Equal(t, n, 7)
	}()

	<-done1
	<-done2
}

// Closing a muxer during a read should unblock, but return an error.
func TestMuxer_CloseDuringRead(t *testing.T) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	alice := NewMuxer(NewReadWriteCloser(r1, w2), false)

	bob := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer func() { assert.NoError(t, bob.Close()) }()

	_, s := alice.Serve()

	go alice.Close()
	buf := make([]byte, 20)
	n, err := s.Read(buf)
	assert.Equal(t, 0, n)
	assert.NotNil(t, err)
	assert.NotEqual(t, io.EOF, err)
}

// Closing a stream during a read should unblock and return io.EOF since this is the way to
// gracefully close a connection.
func TestMuxer_StreamCloseDuringRead(t *testing.T) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	alice := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer func() { assert.NoError(t, alice.Close()) }()

	bob := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer func() { assert.NoError(t, bob.Close()) }()

	_, s := alice.Serve()

	go s.Close()
	buf := make([]byte, 20)
	n, err := s.Read(buf)
	assert.Equal(t, 0, n)
	assert.Equal(t, io.EOF, err)
}

// Closing a stream during a read should unblock and return io.EOF since this is the way for the
// remote to gracefully close a connection.
func TestMuxer_RemoteStreamCloseDuringRead(t *testing.T) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	alice := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer func() { assert.NoError(t, alice.Close()) }()

	bob := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer func() { assert.NoError(t, bob.Close()) }()

	id, as := alice.Serve()
	bs := bob.Connect(id)

	go func() {
		as.Write([]byte("foo"))
		as.Close()
	}()
	buf := make([]byte, 20)
	n, err := bs.Read(buf)
	assert.Equal(t, 3, n)
	assert.Equal(t, "foo", string(buf[:n]))
	n, err = bs.Read(buf)
	assert.Equal(t, 0, n)
	assert.Equal(t, io.EOF, err)
}

// Closing a muxer during a write should unblock, but return an error.
func TestMuxer_CloseDuringWrite(t *testing.T) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	alice := NewMuxer(NewReadWriteCloser(r1, w2), false)

	// Don't connect bob to let writes will block forever.
	defer r2.Close()
	defer w1.Close()

	_, s := alice.Serve()

	go alice.Close()
	buf := make([]byte, 20)
	n, err := s.Write(buf)
	assert.Equal(t, 0, n)
	assert.NotNil(t, err)
	assert.NotEqual(t, io.EOF, err)
}

func TestMuxer_ReadWrite(t *testing.T) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	alice := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer func() { assert.NoError(t, alice.Close()) }()

	bob := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer func() { assert.NoError(t, bob.Close()) }()

	go alice.Write([]byte("hello"))
	buf := make([]byte, 20)
	n, err := bob.Read(buf)
	assert.Equal(t, 5, n)
	assert.Nil(t, err)
	assert.Equal(t, []byte("hello"), buf[:n])
}
