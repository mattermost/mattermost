// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
	mocks2 "github.com/mattermost/mattermost-server/v6/utils/mocks"
	"github.com/mattermost/mattermost-server/v6/utils/testutils"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetOldClientLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	license, _, err := client.GetOldClientLicense("")
	require.NoError(t, err)

	require.NotEqual(t, license["IsLicensed"], "", "license not returned correctly")

	client.Logout()

	_, _, err = client.GetOldClientLicense("")
	require.NoError(t, err)

	resp, err := client.DoAPIGet("/license/client", "")
	require.Error(t, err, "get /license/client did not return an error")
	require.Equal(t, http.StatusBadRequest, resp.StatusCode,
		"expected 400 bad request")

	resp, err = client.DoAPIGet("/license/client?format=junk", "")
	require.Error(t, err, "get /license/client?format=junk did not return an error")
	require.Equal(t, http.StatusBadRequest, resp.StatusCode,
		"expected 400 Bad Request")

	license, _, err = th.SystemAdminClient.GetOldClientLicense("")
	require.NoError(t, err)

	require.NotEmpty(t, license["IsLicensed"], "license not returned correctly")
}

func TestUploadLicenseFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client
	LocalClient := th.LocalClient

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.UploadLicenseFile([]byte{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		resp, err := c.UploadLicenseFile([]byte{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "as system admin user")

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.UploadLicenseFile([]byte{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("restricted admin setting not honoured through local client", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })
		resp, err := LocalClient.UploadLicenseFile([]byte{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("server has already gone through trial", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = false })
		mockLicenseValidator := mocks2.LicenseValidatorIface{}
		defer testutils.ResetLicenseValidator()

		userCount := 100
		mills := model.GetMillis()

		license := model.License{
			Id: "AAAAAAAAAAAAAAAAAAAAAAAAAA",
			Features: &model.Features{
				Users: &userCount,
			},
			Customer: &model.Customer{
				Name: "Test",
			},
			StartsAt:  mills + 100,
			ExpiresAt: mills + 100 + (30*(time.Hour*24) + (time.Hour * 8)).Milliseconds(),
		}

		mockLicenseValidator.On("LicenseFromBytes", mock.Anything).Return(&license, nil).Once()
		licenseBytes, _ := json.Marshal(license)
		licenseStr := string(licenseBytes)

		mockLicenseValidator.On("ValidateLicense", mock.Anything).Return(true, licenseStr)
		utils.LicenseValidator = &mockLicenseValidator

		licenseManagerMock := &mocks.LicenseInterface{}
		licenseManagerMock.On("CanStartTrial").Return(false, nil).Once()
		th.App.Srv().Platform().SetLicenseManager(licenseManagerMock)

		resp, err := th.SystemAdminClient.UploadLicenseFile([]byte("sadasdasdasdasdasdsa"))
		CheckErrorID(t, err, "api.license.request-trial.can-start-trial.not-allowed")
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("try to get gone through trial, with TE build", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = false })
		th.App.Srv().Platform().SetLicenseManager(nil)

		mockLicenseValidator := mocks2.LicenseValidatorIface{}
		defer testutils.ResetLicenseValidator()

		license := model.License{
			Id: model.NewId(),
			Features: &model.Features{
				Users: model.NewInt(100),
			},
			Customer: &model.Customer{
				Name: "Test",
			},
			StartsAt:  model.GetMillis() + 100,
			ExpiresAt: model.GetMillis() + 100 + (30*(time.Hour*24) + (time.Hour * 8)).Milliseconds(),
		}

		mockLicenseValidator.On("LicenseFromBytes", mock.Anything).Return(&license, nil).Once()
		licenseBytes, err := json.Marshal(license)
		require.NoError(t, err)

		mockLicenseValidator.On("ValidateLicense", mock.Anything).Return(true, string(licenseBytes))
		utils.LicenseValidator = &mockLicenseValidator

		resp, err := th.SystemAdminClient.UploadLicenseFile([]byte(""))
		CheckErrorID(t, err, "api.license.upgrade_needed.app_error")
		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("allow uploading sanctioned trials even if server already gone through trial", func(t *testing.T) {
		mockLicenseValidator := mocks2.LicenseValidatorIface{}
		defer testutils.ResetLicenseValidator()

		userCount := 100
		mills := model.GetMillis()

		license := model.License{
			Id: "PPPPPPPPPPPPPPPPPPPPPPPPPP",
			Features: &model.Features{
				Users: &userCount,
			},
			Customer: &model.Customer{
				Name: "Test",
			},
			IsTrial:   true,
			StartsAt:  mills + 100,
			ExpiresAt: mills + 100 + (29*(time.Hour*24) + (time.Hour * 8)).Milliseconds(),
		}

		mockLicenseValidator.On("LicenseFromBytes", mock.Anything).Return(&license, nil).Once()

		licenseBytes, _ := json.Marshal(license)
		licenseStr := string(licenseBytes)

		mockLicenseValidator.On("ValidateLicense", mock.Anything).Return(true, licenseStr)

		utils.LicenseValidator = &mockLicenseValidator

		licenseManagerMock := &mocks.LicenseInterface{}
		licenseManagerMock.On("CanStartTrial").Return(false, nil).Once()
		th.App.Srv().Platform().SetLicenseManager(licenseManagerMock)

		resp, err := th.SystemAdminClient.UploadLicenseFile([]byte("sadasdasdasdasdasdsa"))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestRemoveLicenseFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client
	LocalClient := th.LocalClient

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.RemoveLicenseFile()
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		_, err := c.RemoveLicenseFile()
		require.NoError(t, err)
	}, "as system admin user")

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.RemoveLicenseFile()
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("restricted admin setting not honoured through local client", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		_, err := LocalClient.RemoveLicenseFile()
		require.NoError(t, err)
	})
}

func TestRequestTrialLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	licenseManagerMock := &mocks.LicenseInterface{}
	licenseManagerMock.On("CanStartTrial").Return(true, nil)
	th.App.Srv().Platform().SetLicenseManager(licenseManagerMock)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://localhost:8065/" })

	t.Run("permission denied", func(t *testing.T) {
		resp, err := th.Client.RequestTrialLicense(1000)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("trial license user count less than current users", func(t *testing.T) {
		nUsers := 1
		license := model.NewTestLicense()
		license.Features.Users = model.NewInt(nUsers)
		licenseJSON, jsonErr := json.Marshal(license)
		require.NoError(t, jsonErr)
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusOK)
			response := map[string]string{
				"license": string(licenseJSON),
			}
			err := json.NewEncoder(res).Encode(response)
			require.NoError(t, err)
		}))
		defer testServer.Close()

		mockLicenseValidator := mocks2.LicenseValidatorIface{}
		defer testutils.ResetLicenseValidator()

		mockLicenseValidator.On("ValidateLicense", mock.Anything).Return(true, string(licenseJSON))
		utils.LicenseValidator = &mockLicenseValidator
		licenseManagerMock := &mocks.LicenseInterface{}
		licenseManagerMock.On("CanStartTrial").Return(true, nil).Once()
		th.App.Srv().Platform().SetLicenseManager(licenseManagerMock)

		defer func(requestTrialURL string) {
			platform.RequestTrialURL = requestTrialURL
		}(platform.RequestTrialURL)
		platform.RequestTrialURL = testServer.URL

		resp, err := th.SystemAdminClient.RequestTrialLicense(nUsers)
		CheckErrorID(t, err, "api.license.add_license.unique_users.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("returns status 451 when it receives status 451", func(t *testing.T) {
		nUsers := 1
		license := model.NewTestLicense()
		license.Features.Users = model.NewInt(nUsers)
		licenseJSON, jsonErr := json.Marshal(license)
		require.NoError(t, jsonErr)
		testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
			res.WriteHeader(http.StatusUnavailableForLegalReasons)
		}))
		defer testServer.Close()

		mockLicenseValidator := mocks2.LicenseValidatorIface{}
		defer testutils.ResetLicenseValidator()

		mockLicenseValidator.On("ValidateLicense", mock.Anything).Return(true, string(licenseJSON))
		utils.LicenseValidator = &mockLicenseValidator
		licenseManagerMock := &mocks.LicenseInterface{}
		licenseManagerMock.On("CanStartTrial").Return(true, nil).Once()
		th.App.Srv().Platform().SetLicenseManager(licenseManagerMock)

		defer func(requestTrialURL string) {
			platform.RequestTrialURL = requestTrialURL
		}(platform.RequestTrialURL)
		platform.RequestTrialURL = testServer.URL

		resp, err := th.SystemAdminClient.RequestTrialLicense(nUsers)
		require.Error(t, err)
		require.Equal(t, resp.StatusCode, 451)
	})

	th.App.Srv().Platform().SetLicenseManager(nil)
	t.Run("trial license should fail if LicenseManager is nil", func(t *testing.T) {
		resp, err := th.SystemAdminClient.RequestTrialLicense(1)
		CheckErrorID(t, err, "api.license.upgrade_needed.app_error")
		CheckForbiddenStatus(t, resp)
	})
}

func TestRequestRenewalLink(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	require.NotPanics(t, func() {
		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = nil
		resp, err := th.SystemAdminClient.DoAPIGet("/license/renewal", "")
		CheckErrorID(t, err, "app.license.generate_renewal_token.no_license")
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestRequestTrueUpReview(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("returns status 200 when telemetry data sent", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIPost("/license/review", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("returns 501 when ran by cloud user", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		resp, err := th.SystemAdminClient.DoAPIPost("/license/review", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)

		th.App.Srv().SetLicense(model.NewTestLicense())
	})

	t.Run("returns 403 when user does not have permissions", func(t *testing.T) {
		resp, err := th.Client.DoAPIPost("/license/review", "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("returns 400 when license is nil", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)

		resp, err := th.SystemAdminClient.DoAPIPost("/license/review", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

func TestTrueUpReviewStatus(t *testing.T) {
	th := Setup(t)

	defer th.TearDown()
	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("returns 200 when status retrieved", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet("/license/review/status", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("returns 501 when ran by cloud user", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		resp, err := th.SystemAdminClient.DoAPIGet("/license/review/status", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)

		th.App.Srv().SetLicense(model.NewTestLicense())
	})

	t.Run("returns 403 when user does not have permissions", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet("/license/review/status", "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("returns 400 when license is nil", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)

		resp, err := th.SystemAdminClient.DoAPIGet("/license/review/status", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}
