// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetHostUptimeSeconds(t *testing.T) {
	t.Run("returns a positive value from kern.boottime", func(t *testing.T) {
		seconds, err := getHostUptimeSeconds()
		require.NoError(t, err)
		assert.Positive(t, seconds)
	})
}
