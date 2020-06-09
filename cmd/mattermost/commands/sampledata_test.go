// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSampledataBadParameters(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// should fail because you need at least 1 worker
	require.Error(t, th.RunCommand(t, "sampledata", "--workers", "0"))

	// should fail because you have more team memberships than teams
	require.Error(t, th.RunCommand(t, "sampledata", "--teams", "10", "--teams-memberships", "11"))

	// should fail because you have more channel memberships than channels per team
	require.Error(t, th.RunCommand(t, "sampledata", "--channels-per-team", "10", "--channel-memberships", "11"))
}
