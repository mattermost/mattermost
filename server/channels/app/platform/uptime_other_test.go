// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux && !darwin

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetHostUptimeSeconds(t *testing.T) {
	seconds, err := getHostUptimeSeconds()
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrHostUptimeUnsupportedPlatform)
	assert.Equal(t, int64(0), seconds)
}
