// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestShouldDeactivatePlugin(t *testing.T) {
	health := newPluginHealthStatus()
	require.NotNil(t, health)

	// No failures, don't restart
	result := shouldDeactivatePlugin(health)
	require.Equal(t, false, result)

	now := time.Now()

	// Failures are recent enough to restart
	health = newPluginHealthStatus()
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.2*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.1*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now)

	result = shouldDeactivatePlugin(health)
	require.Equal(t, true, result)

	// Failures are too spaced out to warrant a restart
	health = newPluginHealthStatus()
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*2*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*1*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now)

	result = shouldDeactivatePlugin(health)
	require.Equal(t, false, result)

	// Not enough failures are present to warrant a restart
	health = newPluginHealthStatus()
	health.failTimeStamps = append(health.failTimeStamps, now.Add(-HEALTH_CHECK_DISABLE_DURATION*0.1*time.Minute))
	health.failTimeStamps = append(health.failTimeStamps, now)

	result = shouldDeactivatePlugin(health)
	require.Equal(t, false, result)
}
