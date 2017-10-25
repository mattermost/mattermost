// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"io"
	"net/http"
	"net/rpc"
)

type LocalHTTPResponseWriter struct {
	w http.ResponseWriter
}

func (w *LocalHTTPResponseWriter) Header(args struct{}, reply *http.Header) error {
	*reply = w.w.Header()
	return nil
}

func (w *LocalHTTPResponseWriter) Write(args []byte, reply *struct{}) error {
	_, err := w.w.Write(args)
	return err
}

func (w *LocalHTTPResponseWriter) WriteHeader(args int, reply *struct{}) error {
	w.w.WriteHeader(args)
	return nil
}

func (w *LocalHTTPResponseWriter) SyncHeader(args http.Header, reply *struct{}) error {
	dest := w.w.Header()
	for k := range dest {
		if _, ok := args[k]; !ok {
			delete(dest, k)
		}
	}
	for k, v := range args {
		dest[k] = v
	}
	return nil
}

func ServeHTTPResponseWriter(w http.ResponseWriter, conn io.ReadWriteCloser) {
	server := rpc.NewServer()
	server.Register(&LocalHTTPResponseWriter{
		w: w,
	})
	server.ServeConn(conn)
}

type RemoteHTTPResponseWriter struct {
	client *rpc.Client
	header http.Header
}

var _ http.ResponseWriter = (*RemoteHTTPResponseWriter)(nil)

func (w *RemoteHTTPResponseWriter) Header() http.Header {
	if w.header == nil {
		w.client.Call("LocalHTTPResponseWriter.Header", struct{}{}, &w.header)
	}
	return w.header
}

func (w *RemoteHTTPResponseWriter) Write(b []byte) (int, error) {
	if err := w.client.Call("LocalHTTPResponseWriter.SyncHeader", w.header, nil); err != nil {
		return 0, err
	}
	if err := w.client.Call("LocalHTTPResponseWriter.Write", b, nil); err != nil {
		return 0, err
	}
	return len(b), nil
}

func (w *RemoteHTTPResponseWriter) WriteHeader(statusCode int) {
	if err := w.client.Call("LocalHTTPResponseWriter.SyncHeader", w.header, nil); err != nil {
		return
	}
	w.client.Call("LocalHTTPResponseWriter.WriteHeader", statusCode, nil)
}

func (h *RemoteHTTPResponseWriter) Close() error {
	return h.client.Close()
}

func ConnectHTTPResponseWriter(conn io.ReadWriteCloser) *RemoteHTTPResponseWriter {
	return &RemoteHTTPResponseWriter{
		client: rpc.NewClient(conn),
	}
}
