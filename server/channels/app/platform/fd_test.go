// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetOpenFileDescriptors(t *testing.T) {
	count, err := getOpenFileDescriptors()
	require.NoError(t, err)
	if count == -1 {
		return
	}
	assert.Positive(t, count)
}

func TestGetMaxFileDescriptors(t *testing.T) {
	maxFDs, err := getMaxFileDescriptors()
	require.NoError(t, err)
	// -1 means unsupported platform; otherwise should be positive
	assert.True(t, maxFDs == -1 || maxFDs > 0, "maxFDs should be -1 (unsupported) or positive, got %d", maxFDs)
}
