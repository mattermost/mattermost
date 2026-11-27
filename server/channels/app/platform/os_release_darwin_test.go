// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sys/unix"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestMacOSRelease(t *testing.T) {
	assert.Equal(t, &model.SupportPacketOSRelease{
		ID:         "macos",
		VersionID:  "15.1",
		PrettyName: "macOS 15.1 (24B83)",
	}, macOSRelease("15.1", "24B83"))
}

func TestGetOSReleaseDarwin(t *testing.T) {
	osRelease, err := getOSRelease()
	require.NoError(t, err)
	require.NotNil(t, osRelease)
	assert.Equal(t, "macos", osRelease.ID)
	assert.Regexp(t, `^\d+(\.\d+)*$`, osRelease.VersionID)
	assert.Contains(t, osRelease.PrettyName, "macOS "+osRelease.VersionID+" (")
}

func TestGetKernelReleaseDarwin(t *testing.T) {
	expected, err := unix.Sysctl("kern.osrelease")
	require.NoError(t, err)

	kernelRelease, err := getKernelRelease()
	require.NoError(t, err)
	require.NotNil(t, kernelRelease)
	assert.Equal(t, expected, *kernelRelease)
}

func TestGetRunningInContainerDarwin(t *testing.T) {
	runningInContainer, err := getRunningInContainer("docker")
	require.NoError(t, err)
	assert.Equal(t, new(false), runningInContainer)
}
