// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"bufio"
	"errors"
	"net"
	"net/http"
	"net/rpc"
	"time"
)

const (
	hijackedConnReadBufSize = 4096
)

var (
	ErrNotHijacked     = errors.New("response is not hijacked")
	ErrAlreadyHijacked = errors.New("response was already hijacked")
	ErrCannotHijack    = errors.New("response cannot be hijacked")
)

func (w *httpResponseWriterRPCServer) HjConnRWRead(b []byte, reply *[]byte) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	data := make([]byte, len(b))
	n, err := w.hjr.bufrw.Read(data)
	if err != nil {
		return err
	}
	*reply = data[:n]
	return nil
}

func (w *httpResponseWriterRPCServer) HjConnRWWrite(b []byte, reply *int) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	n, err := w.hjr.bufrw.Write(b)
	if err != nil {
		return err
	}
	*reply = n
	return nil
}

func (w *httpResponseWriterRPCServer) HjConnRead(size int, reply *[]byte) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	if len(w.hjr.readBuf) < size {
		w.hjr.readBuf = make([]byte, size)
	}
	n, err := w.hjr.conn.Read(w.hjr.readBuf[:size])
	if err != nil {
		return err
	}
	*reply = w.hjr.readBuf[:n]
	return nil
}

func (w *httpResponseWriterRPCServer) HjConnWrite(b []byte, reply *int) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	n, err := w.hjr.conn.Write(b)
	if err != nil {
		return err
	}
	*reply = n
	return nil
}

func (w *httpResponseWriterRPCServer) HjConnClose(args struct{}, reply *struct{}) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	return w.hjr.conn.Close()
}

func (w *httpResponseWriterRPCServer) HjConnSetDeadline(t time.Time, reply *struct{}) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	return w.hjr.conn.SetDeadline(t)
}

func (w *httpResponseWriterRPCServer) HjConnSetReadDeadline(t time.Time, reply *struct{}) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	return w.hjr.conn.SetReadDeadline(t)
}

func (w *httpResponseWriterRPCServer) HjConnSetWriteDeadline(t time.Time, reply *struct{}) error {
	if w.hjr == nil {
		return ErrNotHijacked
	}
	return w.hjr.conn.SetWriteDeadline(t)
}

func (w *httpResponseWriterRPCServer) HijackResponse(args struct{}, reply *struct{}) error {
	if w.hjr != nil {
		return ErrAlreadyHijacked
	}
	hj, ok := w.w.(http.Hijacker)
	if !ok {
		return ErrCannotHijack
	}
	conn, bufrw, err := hj.Hijack()
	if err != nil {
		return err
	}

	w.hjr = &hijackedResponse{
		conn:    conn,
		bufrw:   bufrw,
		readBuf: make([]byte, hijackedConnReadBufSize),
	}
	return nil
}

type hijackedConn struct {
	client *rpc.Client
}

type hijackedConnRW struct {
	client *rpc.Client
}

func (w *hijackedConnRW) Read(b []byte) (int, error) {
	var data []byte
	if err := w.client.Call("Plugin.HjConnRWRead", b, &data); err != nil {
		return 0, err
	}
	copy(b, data)
	return len(data), nil
}

func (w *hijackedConnRW) Write(b []byte) (int, error) {
	var n int
	if err := w.client.Call("Plugin.HjConnRWWrite", b, &n); err != nil {
		return 0, err
	}
	return n, nil
}

func (w *hijackedConn) Read(b []byte) (int, error) {
	var data []byte
	if err := w.client.Call("Plugin.HjConnRead", len(b), &data); err != nil {
		return 0, err
	}
	copy(b, data)
	return len(data), nil
}

func (w *hijackedConn) Write(b []byte) (int, error) {
	var n int
	if err := w.client.Call("Plugin.HjConnWrite", b, &n); err != nil {
		return 0, err
	}
	return n, nil
}

func (w *hijackedConn) Close() error {
	return w.client.Call("Plugin.HjConnClose", struct{}{}, nil)
}

func (w *hijackedConn) LocalAddr() net.Addr {
	return nil
}

func (w *hijackedConn) RemoteAddr() net.Addr {
	return nil
}

func (w *hijackedConn) SetDeadline(t time.Time) error {
	return w.client.Call("Plugin.HjConnSetDeadline", t, nil)
}

func (w *hijackedConn) SetReadDeadline(t time.Time) error {
	return w.client.Call("Plugin.HjConnSetReadDeadline", t, nil)
}

func (w *hijackedConn) SetWriteDeadline(t time.Time) error {
	return w.client.Call("Plugin.HjConnSetWriteDeadline", t, nil)
}

func (w *httpResponseWriterRPCClient) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	c := &hijackedConn{
		client: w.client,
	}
	rw := &hijackedConnRW{
		client: w.client,
	}

	if err := w.client.Call("Plugin.HijackResponse", struct{}{}, nil); err != nil {
		return nil, nil, err
	}

	return c, bufio.NewReadWriter(bufio.NewReader(rw), bufio.NewWriter(rw)), nil
}
