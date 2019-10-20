// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package testutils

import (
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUDPTransport(t *testing.T) {
	server, err := NewTUDPServerTransport("127.0.0.1:0")
	require.NoError(t, err)
	defer server.Close()

	assert.NoError(t, server.Open())
	assert.True(t, server.IsOpen())
	assert.NotNil(t, server.Conn())

	c := make(chan []byte)
	defer close(c)

	go serveOnce(t, server, c)

	destAddr, err := net.ResolveUDPAddr("udp", server.Addr().String())
	require.NoError(t, err)

	connUDP, err := net.DialUDP(destAddr.Network(), nil, destAddr)
	require.NoError(t, err)
	defer connUDP.Close()

	n, err := connUDP.Write([]byte("test"))
	assert.NoError(t, err)
	assert.Equal(t, 4, n)

	select {
	case data := <-c:
		assert.Equal(t, "test", string(data))
	case <-time.After(time.Second * 1):
		t.Error("Server did not respond in time")
	}
}

func serveOnce(t *testing.T, transport *TUDPTransport, c chan []byte) {
	b := make([]byte, 65000, 65000)
	n, err := transport.Read(b)
	if err == nil {
		c <- b[:n]
	} else {
		panic("Server failed to read: " + err.Error())
	}
}
