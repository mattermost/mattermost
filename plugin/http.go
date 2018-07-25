// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"io"
	"net/http"
	"net/rpc"
)

type httpResponseWriterRPCServer struct {
	w http.ResponseWriter
}

func (w *httpResponseWriterRPCServer) Header(args struct{}, reply *http.Header) error {
	*reply = w.w.Header()
	return nil
}

func (w *httpResponseWriterRPCServer) Write(args []byte, reply *struct{}) error {
	_, err := w.w.Write(args)
	return err
}

func (w *httpResponseWriterRPCServer) WriteHeader(args int, reply *struct{}) error {
	w.w.WriteHeader(args)
	return nil
}

func (w *httpResponseWriterRPCServer) SyncHeader(args http.Header, reply *struct{}) error {
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

type httpResponseWriterRPCClient struct {
	client *rpc.Client
	header http.Header
}

var _ http.ResponseWriter = (*httpResponseWriterRPCClient)(nil)

func (w *httpResponseWriterRPCClient) Header() http.Header {
	if w.header == nil {
		w.client.Call("Plugin.Header", struct{}{}, &w.header)
	}
	return w.header
}

func (w *httpResponseWriterRPCClient) Write(b []byte) (int, error) {
	if err := w.client.Call("Plugin.SyncHeader", w.header, nil); err != nil {
		return 0, err
	}
	if err := w.client.Call("Plugin.Write", b, nil); err != nil {
		return 0, err
	}
	return len(b), nil
}

func (w *httpResponseWriterRPCClient) WriteHeader(statusCode int) {
	if err := w.client.Call("Plugin.SyncHeader", w.header, nil); err != nil {
		return
	}
	w.client.Call("Plugin.WriteHeader", statusCode, nil)
}

func (h *httpResponseWriterRPCClient) Close() error {
	return h.client.Close()
}

func connectHTTPResponseWriter(conn io.ReadWriteCloser) *httpResponseWriterRPCClient {
	return &httpResponseWriterRPCClient{
		client: rpc.NewClient(conn),
	}
}
