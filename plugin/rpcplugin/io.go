// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"bufio"
	"encoding/binary"
	"io"
)

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
