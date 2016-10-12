// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package netreflect_test

import (
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"runtime"
	"testing"

	"golang.org/x/net/internal/netreflect"
)

func localPath() string {
	f, err := ioutil.TempFile("", "netreflect")
	if err != nil {
		panic(err)
	}
	path := f.Name()
	f.Close()
	os.Remove(path)
	return path
}

func newLocalListener(network string) (net.Listener, error) {
	switch network {
	case "tcp":
		if ln, err := net.Listen("tcp4", "127.0.0.1:0"); err == nil {
			return ln, nil
		}
		return net.Listen("tcp6", "[::1]:0")
	case "tcp4":
		return net.Listen("tcp4", "127.0.0.1:0")
	case "tcp6":
		return net.Listen("tcp6", "[::1]:0")
	case "unix", "unixpacket":
		return net.Listen(network, localPath())
	}
	return nil, fmt.Errorf("%s is not supported", network)
}

func newLocalPacketListener(network string) (net.PacketConn, error) {
	switch network {
	case "udp":
		if c, err := net.ListenPacket("udp4", "127.0.0.1:0"); err == nil {
			return c, nil
		}
		return net.ListenPacket("udp6", "[::1]:0")
	case "udp4":
		return net.ListenPacket("udp4", "127.0.0.1:0")
	case "udp6":
		return net.ListenPacket("udp6", "[::1]:0")
	case "unixgram":
		return net.ListenPacket(network, localPath())
	}
	return nil, fmt.Errorf("%s is not supported", network)
}

func TestSocketOf(t *testing.T) {
	for _, network := range []string{"tcp", "unix", "unixpacket"} {
		switch runtime.GOOS {
		case "darwin":
			if network == "unixpacket" {
				continue
			}
		case "nacl", "plan9":
			continue
		case "windows":
			if network == "unix" || network == "unixpacket" {
				continue
			}
		}
		ln, err := newLocalListener(network)
		if err != nil {
			t.Error(err)
			continue
		}
		defer func() {
			path := ln.Addr().String()
			ln.Close()
			if network == "unix" || network == "unixpacket" {
				os.Remove(path)
			}
		}()
		c, err := net.Dial(ln.Addr().Network(), ln.Addr().String())
		if err != nil {
			t.Error(err)
			continue
		}
		defer c.Close()
		if _, err := netreflect.SocketOf(c); err != nil {
			t.Error(err)
			continue
		}
	}
}

func TestPacketSocketOf(t *testing.T) {
	for _, network := range []string{"udp", "unixgram"} {
		switch runtime.GOOS {
		case "nacl", "plan9":
			continue
		case "windows":
			if network == "unixgram" {
				continue
			}
		}
		c, err := newLocalPacketListener(network)
		if err != nil {
			t.Error(err)
			continue
		}
		defer c.Close()
		if _, err := netreflect.PacketSocketOf(c); err != nil {
			t.Error(err)
			continue
		}
	}
}
