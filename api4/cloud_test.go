// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func Test_getCloudLimits(t *testing.T) {
	t.Run("feature flag off returns not implemented", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		os.Setenv("MM_FEATUREFLAGS_CLOUDFREE", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDFREE")
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.CloudFree = false
		})

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.NoError(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusNotImplemented, r.StatusCode, "Expected 501 Not Implemented")
	})

	t.Run("no license returns not implemented", func(t *testing.T) {
		require.Nil(t, "adsf")
	})

	t.Run("non cloud license returns not implemented", func(t *testing.T) {
	})

	t.Run("error fetching limits returns internal server error", func(t *testing.T) {
	})

	t.Run("good request with cloud server and feature flag returns response", func(t *testing.T) {
	})
}
