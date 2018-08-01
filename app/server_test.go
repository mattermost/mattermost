// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestStartServerSuccess(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := a.StartServer()
	a.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerRateLimiterCriticalError(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	// Attempt to use Rate Limiter with an invalid config
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.RateLimitSettings.Enable = true
		*cfg.RateLimitSettings.MaxBurst = -100
	})

	serverErr := a.StartServer()
	a.Shutdown()
	require.Error(t, serverErr)
}

func TestStartServerPortUnavailable(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	// Attempt to listen on a system-reserved port
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":21"
	})

	serverErr := a.StartServer()
	a.Shutdown()
	require.Error(t, serverErr)
}
