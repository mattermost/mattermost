// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConfigFlag(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	require.Error(t, th.RunCommand(t, "version"))
	th.CheckCommand(t, "--config", "foo.json", "version")
	th.CheckCommand(t, "--config", "./foo.json", "version")
	th.CheckCommand(t, "version")
}
