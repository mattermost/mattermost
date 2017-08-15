package rpcplugin

import (
	"context"
	"fmt"
	"io"
)

func newProcess(ctx context.Context, path string) (Process, io.ReadWriteCloser, error) {
	// TODO
	return nil, nil, fmt.Errorf("not yet supported")
}

func inheritedProcessIPC() (*IPC, error) {
	// TODO
	return nil, fmt.Errorf("not yet supported")
}
