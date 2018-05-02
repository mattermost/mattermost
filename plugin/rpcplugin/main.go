// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"log"
	"os"
)

// Makes a set of hooks available via RPC. This function never returns.
func Main(hooks interface{}) {
	ipc, err := InheritedProcessIPC()
	if err != nil {
		log.Fatal(err.Error())
	}
	muxer := NewMuxer(ipc, true)
	id, conn := muxer.Serve()
	buf := make([]byte, 11)
	buf[0] = 0
	n := binary.PutVarint(buf[1:], id)
	if _, err := muxer.Write(buf[:1+n]); err != nil {
		log.Fatal(err.Error())
	}
	ServeHooks(hooks, conn, muxer)
	os.Exit(0)
}

// Returns the hooks being served by a call to Main.
func ConnectMain(muxer *Muxer, pluginId string) (*RemoteHooks, error) {
	buf := make([]byte, 1)
	if _, err := muxer.Read(buf); err != nil {
		return nil, err
	} else if buf[0] != 0 {
		return nil, fmt.Errorf("unexpected control byte")
	}
	reader := bufio.NewReader(muxer)
	id, err := binary.ReadVarint(reader)
	if err != nil {
		return nil, err
	}

	return ConnectHooks(muxer.Connect(id), muxer, pluginId)
}
