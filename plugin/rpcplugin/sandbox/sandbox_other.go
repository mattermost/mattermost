// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// +build !linux

package sandbox

import (
	"context"
	"fmt"
	"io"

	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
)

func newProcess(ctx context.Context, config *Configuration, path string) (rpcplugin.Process, io.ReadWriteCloser, error) {
	return nil, nil, checkSupport()
}

func checkSupport() error {
	return fmt.Errorf("sandboxing is not supported on this platform")
}
