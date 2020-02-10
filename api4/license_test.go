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
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	license, resp := Client.GetOldClientLicense("")
	CheckNoError(t, resp)

	require.NotEqual(t, license["IsLicensed"], "", "license not returned correctly")

	Client.Logout()

	_, resp = Client.GetOldClientLicense("")
	CheckNoError(t, resp)

	_, err := Client.DoApiGet("/license/client", "")
	require.Error(t, err, "get /license/client did not return an error")
	require.Equal(t, err.StatusCode, http.StatusNotImplemented,
		"expected 501 Not Implemented")

	_, err = Client.DoApiGet("/license/client?format=junk", "")
	require.Error(t, err, "get /license/client?format=junk did not return an error")
	require.Equal(t, err.StatusCode, http.StatusBadRequest,
		"expected 400 Bad Request")

	license, resp = th.SystemAdminClient.GetOldClientLicense("")
	CheckNoError(t, resp)

	if len(license["IsLicensed"]) == 0 {
		t.Fatal("license not returned correctly")
	}
}

func TestUploadLicenseFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	t.Run("as system user", func(t *testing.T) {
		ok, resp := Client.UploadLicenseFile([]byte{})
		CheckForbiddenStatus(t, resp)
		if ok {
			t.Fatal("should fail")
		}
	})

	t.Run("as system admin user", func(t *testing.T) {
		ok, resp := th.SystemAdminClient.UploadLicenseFile([]byte{})
		CheckBadRequestStatus(t, resp)
		if ok {
			t.Fatal("should fail")
		}
	})

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		ok, resp := th.SystemAdminClient.UploadLicenseFile([]byte{})
		CheckForbiddenStatus(t, resp)
		if ok {
			t.Fatal("should fail")
		}
	})
}

func TestRemoveLicenseFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	t.Run("as system user", func(t *testing.T) {
		ok, resp := Client.RemoveLicenseFile()
		CheckForbiddenStatus(t, resp)
		if ok {
			t.Fatal("should fail")
		}
	})

	t.Run("as system admin user", func(t *testing.T) {
		ok, resp := th.SystemAdminClient.RemoveLicenseFile()
		CheckNoError(t, resp)
		if !ok {
			t.Fatal("should pass")
		}
	})

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		ok, resp := th.SystemAdminClient.RemoveLicenseFile()
		CheckForbiddenStatus(t, resp)
		if ok {
			t.Fatal("should fail")
		}
	})
}
