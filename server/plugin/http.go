// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/rpc"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

type hijackedResponse struct {
	conn    net.Conn
	bufrw   *bufio.ReadWriter
	readBuf []byte
}

type httpResponseWriterRPCServer struct {
	w   http.ResponseWriter
	log *mlog.Logger
	hjr *hijackedResponse
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
	// Check if args is a valid http status code. This prevents plugins from crashing the server with a panic.
	// This is a copy of the checkWriteHeaderCode function in net/http/server.go in the go source.
	if args < 100 || args > 999 {
		w.log.Error(fmt.Sprintf("Plugin tried to write an invalid http status code: %v. Did not write the invalid header.", args))
		return errors.New("invalid http status code")
	}
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

func (w *httpResponseWriterRPCClient) Close() error {
	return w.client.Close()
}

func connectHTTPResponseWriter(conn io.ReadWriteCloser) *httpResponseWriterRPCClient {
	return &httpResponseWriterRPCClient{
		client: rpc.NewClient(conn),
	}
}
