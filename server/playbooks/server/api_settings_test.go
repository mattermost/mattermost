// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/server/v8/playbooks/client"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSettings(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("get settings", func(t *testing.T) {
		t.Run("unauthenticated", func(t *testing.T) {
			settings, err := e.UnauthenticatedPlaybooksClient.Settings.Get(context.Background())
			assert.Nil(t, settings)
			requireErrorWithStatusCode(t, err, http.StatusUnauthorized)
		})

		t.Run("get some settings", func(t *testing.T) {
			defaultSettings := &client.GlobalSettings{
				EnableExperimentalFeatures: false,
			}

			settings, err := e.PlaybooksClient.Settings.Get(context.Background())
			require.NoError(t, err)
			assert.Equal(t, defaultSettings, settings)
		})
	})
}
