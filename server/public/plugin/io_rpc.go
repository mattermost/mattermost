// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"bufio"
	"encoding/binary"
	"io"
)

type remoteIOReader struct {
	conn io.ReadWriteCloser
}

func (r *remoteIOReader) Read(b []byte) (int, error) {
	var buf [10]byte
	n := binary.PutVarint(buf[:], int64(len(b)))
	if _, err := r.conn.Write(buf[:n]); err != nil {
		return 0, err
	}
	return r.conn.Read(b)
}

func (r *remoteIOReader) Close() error {
	return r.conn.Close()
}

func connectIOReader(conn io.ReadWriteCloser) io.ReadCloser {
	return &remoteIOReader{conn}
}

func serveIOReader(r io.Reader, conn io.ReadWriteCloser) {
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
