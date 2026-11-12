// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetCPUStats(t *testing.T) {
	stats, err := getCPUStats(cgroupV2Info{})
	require.NoError(t, err)
	assert.Nil(t, stats.ContainerCPUPeriods)
	assert.Nil(t, stats.ContainerCPUThrottledPeriods)
}
