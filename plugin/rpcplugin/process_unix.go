// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// +build !windows

package rpcplugin

import (
	"context"
	"io"
	"os"
	"os/exec"
)

type process struct {
	command *exec.Cmd
}

func newProcess(ctx context.Context, path string) (Process, io.ReadWriteCloser, error) {
	ipc, childFiles, err := NewIPC()
	if err != nil {
		return nil, nil, err
	}
	defer childFiles[0].Close()
	defer childFiles[1].Close()

	cmd := exec.CommandContext(ctx, path)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.ExtraFiles = childFiles
	err = cmd.Start()
	if err != nil {
		ipc.Close()
		return nil, nil, err
	}

	return &process{
		command: cmd,
	}, ipc, nil
}

func (p *process) Wait() error {
	return p.command.Wait()
}

func inheritedProcessIPC() (io.ReadWriteCloser, error) {
	return InheritedIPC(3, 4)
}
