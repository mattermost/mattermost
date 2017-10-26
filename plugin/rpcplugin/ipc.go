// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"io"
	"os"
)

// Returns a new IPC for the parent process and a set of files to pass on to the child.
//
// The returned files must be closed after the child process is started.
func NewIPC() (io.ReadWriteCloser, []*os.File, error) {
	parentReader, childWriter, err := os.Pipe()
	if err != nil {
		return nil, nil, err
	}
	childReader, parentWriter, err := os.Pipe()
	if err != nil {
		parentReader.Close()
		childWriter.Close()
		return nil, nil, err
	}
	return NewReadWriteCloser(parentReader, parentWriter), []*os.File{childReader, childWriter}, nil
}

// Returns the IPC instance inherited by the process from its parent.
func InheritedIPC(fd0, fd1 uintptr) (io.ReadWriteCloser, error) {
	return NewReadWriteCloser(os.NewFile(fd0, ""), os.NewFile(fd1, "")), nil
}
