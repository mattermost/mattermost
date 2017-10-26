// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"context"
	"io"
)

type Process interface {
	// Waits for the process to exit and returns an error if a problem occurred or the process exited
	// with a non-zero status.
	Wait() error
}

// NewProcess launches an RPC executable in a new process and returns an IPC that can be used to
// communicate with it.
func NewProcess(ctx context.Context, path string) (Process, io.ReadWriteCloser, error) {
	return newProcess(ctx, path)
}

// When called on a process launched with NewProcess, returns the inherited IPC.
func InheritedProcessIPC() (io.ReadWriteCloser, error) {
	return inheritedProcessIPC()
}
