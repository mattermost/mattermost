// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetIntegrationsUsage(t *testing.T) {
	t.Run("unauthenticated users can not access", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.Client.Logout()

		usage, r, err := th.Client.GetIntegrationsUsage()
		assert.Error(t, err)
		assert.Nil(t, usage)
		assert.Equal(t, http.StatusUnauthorized, r.StatusCode)
	})

	t.Run("good request returns response", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		usage, r, err := th.Client.GetIntegrationsUsage()
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, r.StatusCode)
		assert.NotNil(t, usage)
		assert.Equal(t, 0, usage.Count)
	})
}
