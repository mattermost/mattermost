package rpcplugin

import (
	"fmt"
	"io"
)

func newProcess(path string) (Process, io.ReadWriteCloser, error) {
	// TODO
	return nil, nil, fmt.Errorf("not yet supported")
}

func inheritedProcessIPC() (*IPC, error) {
	// TODO
	return nil, fmt.Errorf("not yet supported")
}
