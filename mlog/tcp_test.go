// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import (
	"bufio"
	"bytes"
	"fmt"
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

const (
	testPort = 18066
)

func TestNewTcpTarget(t *testing.T) {
	target := LogTarget{
		Type:         "tcp",
		Format:       "json",
		Levels:       []LogLevel{LvlInfo},
		Options:      map[string]interface{}{"IP": "localhost", "Port": testPort},
		MaxQueueSize: 1000,
	}
	targets := map[string]*LogTarget{"tcp_test": &target}

	t.Run("logging", func(t *testing.T) {
		var buf bytes.Buffer
		server, err := newSocketServer(testPort, &buf)
		require.NoError(t, err)
		defer server.stopServer()

		data := []string{"I drink your milkshake!", "We don't need no badges!", "You can't fight in here! This is the war room!"}

		logr, err := newLogr(targets)
		require.NoError(t, err)

		for _, s := range data {
			logr.Info(s)
		}
		err = logr.Logr().Shutdown()
		require.NoError(t, err)

		sdata := buf.String()
		for _, s := range data {
			require.Contains(t, sdata, s)
		}
	})
}

type socketServer struct {
	listener net.Listener
	buf      *bytes.Buffer
	conns    map[string]net.Conn
}

func newSocketServer(port int, buf *bytes.Buffer) (*socketServer, error) {
	ss := &socketServer{
		buf:   buf,
		conns: make(map[string]net.Conn),
	}

	addy := fmt.Sprintf(":%d", port)
	l, err := net.Listen("tcp4", addy)
	if err != nil {
		return nil, err
	}
	ss.listener = l

	go ss.listen()
	return ss, nil
}

func (ss *socketServer) listen() {
	for {
		c, err := ss.listener.Accept()
		if err != nil {
			return
		}
		go ss.handleConnection(c)
	}
}

func (ss *socketServer) handleConnection(conn net.Conn) {
	raddy := conn.RemoteAddr().String()
	defer delete(ss.conns, raddy)
	defer conn.Close()

	reader := bufio.NewReader(conn)

	for {
		data, err := reader.ReadString('\n')
		if err != nil {
			return
		}
		ss.buf.WriteString(data)
	}
}

func (ss *socketServer) stopServer() {
	ss.listener.Close()
	for k, conn := range ss.conns {
		conn.Close()
		delete(ss.conns, k)
	}
}
