// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"io"
	"net/http"
	"net/rpc"
)

type HTTPResponseWriterRPCServer struct {
	w http.ResponseWriter
}

func (w *HTTPResponseWriterRPCServer) Header(args struct{}, reply *http.Header) error {
	*reply = w.w.Header()
	return nil
}

func (w *HTTPResponseWriterRPCServer) Write(args []byte, reply *struct{}) error {
	_, err := w.w.Write(args)
	return err
}

func (w *HTTPResponseWriterRPCServer) WriteHeader(args int, reply *struct{}) error {
	w.w.WriteHeader(args)
	return nil
}

func (w *HTTPResponseWriterRPCServer) SyncHeader(args http.Header, reply *struct{}) error {
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
	server.Register(&HTTPResponseWriterRPCServer{
		w: w,
	})
	server.ServeConn(conn)
}

type HTTPResponseWriterRPCClient struct {
	client *rpc.Client
	header http.Header
}

var _ http.ResponseWriter = (*HTTPResponseWriterRPCClient)(nil)

func (w *HTTPResponseWriterRPCClient) Header() http.Header {
	if w.header == nil {
		w.client.Call("Plugin.Header", struct{}{}, &w.header)
	}
	return w.header
}

func (w *HTTPResponseWriterRPCClient) Write(b []byte) (int, error) {
	if err := w.client.Call("Plugin.SyncHeader", w.header, nil); err != nil {
		return 0, err
	}
	if err := w.client.Call("Plugin.Write", b, nil); err != nil {
		return 0, err
	}
	return len(b), nil
}

func (w *HTTPResponseWriterRPCClient) WriteHeader(statusCode int) {
	if err := w.client.Call("Plugin.SyncHeader", w.header, nil); err != nil {
		return
	}
	w.client.Call("Plugin.WriteHeader", statusCode, nil)
}

func (h *HTTPResponseWriterRPCClient) Close() error {
	return h.client.Close()
}

func ConnectHTTPResponseWriter(conn io.ReadWriteCloser) *HTTPResponseWriterRPCClient {
	return &HTTPResponseWriterRPCClient{
		client: rpc.NewClient(conn),
	}
}
