// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sandbox

import (
	"testing"

	"github.com/mattermost/mattermost-server/plugin/rpcplugin/rpcplugintest"
)

func TestSupervisorProvider(t *testing.T) {
	if err := CheckSupport(); err != nil {
		t.Skip("sandboxing not supported:", err)
	}

	rpcplugintest.TestSupervisorProvider(t, SupervisorProvider)
}
