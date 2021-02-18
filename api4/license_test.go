// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetOldClientLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client

	license, resp := Client.GetOldClientLicense("")
	CheckNoError(t, resp)

	require.NotEqual(t, license["IsLicensed"], "", "license not returned correctly")

	Client.Logout()

	_, resp = Client.GetOldClientLicense("")
	CheckNoError(t, resp)

	_, err := Client.DoApiGet("/license/client", "")
	require.NotNil(t, err, "get /license/client did not return an error")
	require.Equal(t, err.StatusCode, http.StatusNotImplemented,
		"expected 501 Not Implemented")

	_, err = Client.DoApiGet("/license/client?format=junk", "")
	require.NotNil(t, err, "get /license/client?format=junk did not return an error")
	require.Equal(t, err.StatusCode, http.StatusBadRequest,
		"expected 400 Bad Request")

	license, resp = th.SystemAdminClient.GetOldClientLicense("")
	CheckNoError(t, resp)

	require.NotEmpty(t, license["IsLicensed"], "license not returned correctly")
}

func TestUploadLicenseFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client
	LocalClient := th.LocalClient

	t.Run("as system user", func(t *testing.T) {
		ok, resp := Client.UploadLicenseFile([]byte{})
		CheckForbiddenStatus(t, resp)
		require.False(t, ok)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		ok, resp := c.UploadLicenseFile([]byte{})
		CheckBadRequestStatus(t, resp)
		require.False(t, ok)
	}, "as system admin user")

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		ok, resp := th.SystemAdminClient.UploadLicenseFile([]byte{})
		CheckForbiddenStatus(t, resp)
		require.False(t, ok)
	})

	t.Run("restricted admin setting not honoured through local client", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })
		ok, resp := LocalClient.UploadLicenseFile([]byte{})
		CheckBadRequestStatus(t, resp)
		require.False(t, ok)
	})
}

func TestRemoveLicenseFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client
	LocalClient := th.LocalClient

	t.Run("as system user", func(t *testing.T) {
		ok, resp := Client.RemoveLicenseFile()
		CheckForbiddenStatus(t, resp)
		require.False(t, ok)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		ok, resp := c.RemoveLicenseFile()
		CheckNoError(t, resp)
		require.True(t, ok)
	}, "as system admin user")

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		ok, resp := th.SystemAdminClient.RemoveLicenseFile()
		CheckForbiddenStatus(t, resp)
		require.False(t, ok)
	})

	t.Run("restricted admin setting not honoured through local client", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		ok, resp := LocalClient.RemoveLicenseFile()
		CheckNoError(t, resp)
		require.True(t, ok)
	})
}
