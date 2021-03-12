// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSampledataBadParameters(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should fail because you need at least 1 worker", func(t *testing.T) {
		require.Error(t, th.RunCommand(t, "sampledata", "--workers", "0"))
	})

	t.Run("should fail because you have more team memberships than teams", func(t *testing.T) {
		require.Error(t, th.RunCommand(t, "sampledata", "--teams", "10", "--teams-memberships", "11"))
	})

	t.Run("should fail because you have more channel memberships than channels per team", func(t *testing.T) {
		require.Error(t, th.RunCommand(t, "sampledata", "--channels-per-team", "10", "--channel-memberships", "11"))
	})

	t.Run("should fail because you have group channels and don't have enough users (6 users)", func(t *testing.T) {
		require.Error(t, th.RunCommand(t, "sampledata", "--group-channels", "1", "--users", "5"))
	})

	t.Run("should not fail with less than 6 users and no group channels", func(t *testing.T) {
		f, err := ioutil.TempFile("", "*")
		require.NoError(t, err)
		f.Close()
		defer os.Remove(f.Name())
		require.NoError(t, th.RunCommand(t, "sampledata", "--group-channels", "0", "--users", "5", "--bulk", f.Name()))
	})

	t.Run("should not fail with less than 6 users and no group channels", func(t *testing.T) {
		f, err := ioutil.TempFile("", "*")
		require.NoError(t, err)
		f.Close()
		defer os.Remove(f.Name())
		require.NoError(t, th.RunCommand(t, "sampledata", "--group-channels", "0", "--users", "5", "--bulk", f.Name()))
	})
}
