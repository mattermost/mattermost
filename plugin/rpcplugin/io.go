package rpcplugin

import (
	"bufio"
	"encoding/binary"
	"io"
	"os"
)

type rwc struct {
	io.ReadCloser
	io.WriteCloser
}

func (rwc *rwc) Close() (err error) {
	if f, ok := rwc.ReadCloser.(*os.File); ok {
		// https://groups.google.com/d/topic/golang-nuts/i4w58KJ5-J8/discussion
		err = os.NewFile(f.Fd(), "").Close()
	} else {
		err = rwc.ReadCloser.Close()
	}
	werr := rwc.WriteCloser.Close()
	if err == nil {
		err = werr
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
