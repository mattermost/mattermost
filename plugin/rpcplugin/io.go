package rpcplugin

import (
	"io"
)

type rwc struct {
	io.ReadCloser
	io.WriteCloser
}

func (rwc *rwc) Close() error {
	rerr := rwc.ReadCloser.Close()
	werr := rwc.WriteCloser.Close()
	if rerr != nil {
		return rerr
	}
	return werr
}

func NewReadWriteCloser(r io.ReadCloser, w io.WriteCloser) io.ReadWriteCloser {
	return &rwc{r, w}
}
