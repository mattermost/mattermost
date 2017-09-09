package rpcplugin

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"io"
	"sync"
)

type asyncRead struct {
	b   []byte
	err error
}

type asyncReadCloser struct {
	io.ReadCloser
	buffer    bytes.Buffer
	read      chan struct{}
	reads     chan asyncRead
	close     chan struct{}
	closeOnce sync.Once
}

// NewAsyncReadCloser returns a ReadCloser that supports Close during Read.
func NewAsyncReadCloser(r io.ReadCloser) io.ReadCloser {
	ret := &asyncReadCloser{
		ReadCloser: r,
		read:       make(chan struct{}),
		reads:      make(chan asyncRead),
		close:      make(chan struct{}),
	}
	go ret.loop()
	return ret
}

func (r *asyncReadCloser) loop() {
	buf := make([]byte, 1024*8)
	var n int
	var err error
	for {
		select {
		case <-r.read:
			n = 0
			if err == nil {
				n, err = r.ReadCloser.Read(buf)
			}
			select {
			case r.reads <- asyncRead{buf[:n], err}:
			case <-r.close:
			}
		case <-r.close:
			r.ReadCloser.Close()
			return
		}
	}
}

func (r *asyncReadCloser) Read(b []byte) (int, error) {
	if r.buffer.Len() > 0 {
		return r.buffer.Read(b)
	}
	select {
	case r.read <- struct{}{}:
	case <-r.close:
	}
	select {
	case read := <-r.reads:
		if read.err != nil {
			return 0, read.err
		}
		n := copy(b, read.b)
		if n < len(read.b) {
			r.buffer.Write(read.b[n:])
		}
		return n, nil
	case <-r.close:
		return 0, io.EOF
	}
}

func (r *asyncReadCloser) Close() error {
	r.closeOnce.Do(func() {
		close(r.close)
	})
	return nil
}

type asyncWrite struct {
	n   int
	err error
}

type asyncWriteCloser struct {
	io.WriteCloser
	writeBuffer bytes.Buffer
	write       chan struct{}
	writes      chan asyncWrite
	close       chan struct{}
	closeOnce   sync.Once
}

// NewAsyncWriteCloser returns a WriteCloser that supports Close during Write.
func NewAsyncWriteCloser(w io.WriteCloser) io.WriteCloser {
	ret := &asyncWriteCloser{
		WriteCloser: w,
		write:       make(chan struct{}),
		writes:      make(chan asyncWrite),
		close:       make(chan struct{}),
	}
	go ret.loop()
	return ret
}

func (w *asyncWriteCloser) loop() {
	var n int64
	var err error
	for {
		select {
		case <-w.write:
			n = 0
			if err == nil {
				n, err = w.writeBuffer.WriteTo(w.WriteCloser)
			}
			select {
			case w.writes <- asyncWrite{int(n), err}:
			case <-w.close:
			}
		case <-w.close:
			w.WriteCloser.Close()
			return
		}
	}
}

func (w *asyncWriteCloser) Write(b []byte) (int, error) {
	if n, err := w.writeBuffer.Write(b); err != nil {
		return n, err
	}
	select {
	case w.write <- struct{}{}:
	case <-w.close:
	}
	select {
	case write := <-w.writes:
		return write.n, write.err
	case <-w.close:
		return 0, io.EOF
	}
}

func (w *asyncWriteCloser) Close() error {
	w.closeOnce.Do(func() {
		close(w.close)
	})
	return nil
}

type rwc struct {
	io.ReadCloser
	io.WriteCloser
}

func (rwc *rwc) Close() (err error) {
	err = rwc.WriteCloser.Close()
	if rerr := rwc.ReadCloser.Close(); err == nil {
		err = rerr
	}
	return
}

func NewReadWriteCloser(r io.ReadCloser, w io.WriteCloser) io.ReadWriteCloser {
	return &rwc{r, w}
}

type RemoteIOReader struct {
	conn io.ReadWriteCloser
}

func (r *RemoteIOReader) Read(b []byte) (int, error) {
	var buf [10]byte
	n := binary.PutVarint(buf[:], int64(len(b)))
	if _, err := r.conn.Write(buf[:n]); err != nil {
		return 0, err
	}
	return r.conn.Read(b)
}

func (r *RemoteIOReader) Close() error {
	return r.conn.Close()
}

func ConnectIOReader(conn io.ReadWriteCloser) io.ReadCloser {
	return &RemoteIOReader{conn}
}

func ServeIOReader(r io.Reader, conn io.ReadWriteCloser) {
	cr := bufio.NewReader(conn)
	defer conn.Close()
	buf := make([]byte, 32*1024)
	for {
		n, err := binary.ReadVarint(cr)
		if err != nil {
			break
		}
		if written, err := io.CopyBuffer(conn, io.LimitReader(r, n), buf); err != nil || written < n {
			break
		}
	}
}
