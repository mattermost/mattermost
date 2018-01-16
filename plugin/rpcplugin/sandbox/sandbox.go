// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sandbox

import (
	"context"
	"io"

	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

type MountPoint struct {
	Source      string
	Destination string
	Type        string
	ReadOnly    bool
}

type Configuration struct {
	MountPoints      []*MountPoint
	WorkingDirectory string
}

// NewProcess is like rpcplugin.NewProcess, but launches the process in a sandbox.
func NewProcess(ctx context.Context, config *Configuration, path string) (rpcplugin.Process, io.ReadWriteCloser, error) {
	return newProcess(ctx, config, path)
}

// CheckSupport inspects the platform and environment to determine whether or not there are any
// expected issues with sandboxing. If nil is returned, sandboxing should be used.
func CheckSupport() error {
	return checkSupport()
}
