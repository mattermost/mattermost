// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResultHelpersUseHealthRuleIDs(t *testing.T) {
	t.Parallel()

	firing := Firing("health.rule.push_empty_url.message")
	unknown := Unknown("health.rule.push_empty_url.unknown.config_absent")

	require.True(t, strings.HasPrefix(firing.MessageID, "health.rule."))
	require.True(t, strings.HasPrefix(unknown.MessageID, "health.rule."))
}

func TestResultHelpers(t *testing.T) {
	t.Parallel()

	t.Run("firing and unknown subject helpers", func(t *testing.T) {
		result := FiringSubject("ServiceSettings.SiteURL", "health.rule.site_url.message")
		require.Equal(t, StateFiring, result.State)
		require.Equal(t, "ServiceSettings.SiteURL", result.Subject)

		unknown := UnknownSubject("SqlSettings.DataSource", "health.rule.datasource.unknown")
		require.Equal(t, StateUnknown, unknown.State)
		require.Equal(t, "SqlSettings.DataSource", unknown.Subject)
	})

	t.Run("with detail and value", func(t *testing.T) {
		result := Resolved().WithDetail("threshold", "80").WithValue(73.2)
		require.Equal(t, StateResolved, result.State)
		require.Equal(t, "80", result.Details["threshold"])
		require.NotNil(t, result.Value)
		require.Equal(t, 73.2, *result.Value)
	})
}
