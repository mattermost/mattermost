// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"errors"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest/mock"
)

func Test_getCloudLimits(t *testing.T) {
	t.Run("feature flag off returns empty limits", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		os.Setenv("MM_FEATUREFLAGS_CLOUDFREE", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDFREE")
		th.App.ReloadConfig()

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.NoError(t, err)
		require.Equal(t, limits, &model.ProductLimits{})
		require.Equal(t, http.StatusOK, r.StatusCode, "Expected 200 OK")
	})

	t.Run("no license returns not implemented", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		os.Setenv("MM_FEATUREFLAGS_CLOUDFREE", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDFREE")
		th.App.ReloadConfig()

		th.App.Srv().RemoveLicense()

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusNotImplemented, r.StatusCode, "Expected 501 Not Implemented")
	})

	t.Run("non cloud license returns not implemented", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		os.Setenv("MM_FEATUREFLAGS_CLOUDFREE", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDFREE")
		th.App.ReloadConfig()

		th.App.Srv().SetLicense(model.NewTestLicense())

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusNotImplemented, r.StatusCode, "Expected 501 Not Implemented")
	})

	t.Run("error fetching limits returns internal server error", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		os.Setenv("MM_FEATUREFLAGS_CLOUDFREE", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDFREE")
		th.App.ReloadConfig()
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(nil, errors.New("Unable to get limits"))

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusInternalServerError, r.StatusCode, "Expected 500 Internal Server Error")
	})

	t.Run("unauthenticated users can not access", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Logout()

		limits, r, err := th.Client.GetProductLimits()
		require.Error(t, err)
		require.Nil(t, limits)
		require.Equal(t, http.StatusUnauthorized, r.StatusCode, "Expected 401 Unauthorized")
	})

	t.Run("good request with cloud server and feature flag returns response", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		os.Setenv("MM_FEATUREFLAGS_CLOUDFREE", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDFREE")
		th.App.ReloadConfig()
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		cloud := &mocks.CloudInterface{}
		ten := 10
		mockLimits := &model.ProductLimits{
			Messages: &model.MessagesLimits{
				History: &ten,
			},
		}
		cloud.Mock.On("GetCloudLimits", mock.Anything).Return(mockLimits, nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = cloud

		th.Client.Login(th.BasicUser.Email, th.BasicUser.Password)

		limits, r, err := th.Client.GetProductLimits()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, r.StatusCode, "Expected 200 OK")
		require.Equal(t, mockLimits, limits)
		require.Equal(t, *mockLimits.Messages.History, *limits.Messages.History)
	})
}
