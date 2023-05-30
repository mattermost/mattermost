// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
	mocks2 "github.com/mattermost/mattermost-server/server/v8/channels/utils/mocks"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost-server/server/v8/einterfaces/mocks"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetOldClientLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	license, _, err := client.GetOldClientLicense(context.Background(), "")
	require.NoError(t, err)

	require.NotEqual(t, license["IsLicensed"], "", "license not returned correctly")

	client.Logout(context.Background())

	_, _, err = client.GetOldClientLicense(context.Background(), "")
	require.NoError(t, err)

	resp, err := client.DoAPIGet(context.Background(), "/license/client", "")
	require.Error(t, err, "get /license/client did not return an error")
	require.Equal(t, http.StatusBadRequest, resp.StatusCode,
		"expected 400 bad request")

	resp, err = client.DoAPIGet(context.Background(), "/license/client?format=junk", "")
	require.Error(t, err, "get /license/client?format=junk did not return an error")
	require.Equal(t, http.StatusBadRequest, resp.StatusCode,
		"expected 400 Bad Request")

	license, _, err = th.SystemAdminClient.GetOldClientLicense(context.Background(), "")
	require.NoError(t, err)

	require.NotEmpty(t, license["IsLicensed"], "license not returned correctly")
}

func TestUploadLicenseFile(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client
	LocalClient := th.LocalClient

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.UploadLicenseFile(context.Background(), []byte{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		resp, err := c.UploadLicenseFile(context.Background(), []byte{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "as system admin user")

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.UploadLicenseFile(context.Background(), []byte{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("restricted admin setting not honoured through local client", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })
		resp, err := LocalClient.UploadLicenseFile(context.Background(), []byte{})
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

		resp, err := th.SystemAdminClient.UploadLicenseFile(context.Background(), []byte("sadasdasdasdasdasdsa"))
		CheckErrorID(t, err, "api.license.request-trial.can-start-trial.not-allowed")
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("try to get one through trial, with TE build", func(t *testing.T) {
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

		resp, err := th.SystemAdminClient.UploadLicenseFile(context.Background(), []byte(""))
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

		resp, err := th.SystemAdminClient.UploadLicenseFile(context.Background(), []byte("sadasdasdasdasdasdsa"))
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
		resp, err := client.RemoveLicenseFile(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		_, err := c.RemoveLicenseFile(context.Background())
		require.NoError(t, err)
	}, "as system admin user")

	t.Run("as restricted system admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.RemoveLicenseFile(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("restricted admin setting not honoured through local client", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		_, err := LocalClient.RemoveLicenseFile(context.Background())
		require.NoError(t, err)
	})
}

func TestRequestTrialLicenseWithExtraFields(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	licenseManagerMock := &mocks.LicenseInterface{}
	licenseManagerMock.On("CanStartTrial").Return(true, nil)
	th.App.Srv().Platform().SetLicenseManager(licenseManagerMock)
	cloud := mocks.CloudInterface{}

	cloudImpl := th.App.Srv().Cloud
	defer func() {
		th.App.Srv().Cloud = cloudImpl
	}()
	th.App.Srv().Cloud = &cloud

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://localhost:8065/" })
	nUsers := 1
	validTrialRequest := &model.TrialLicenseRequest{
		Email:          "test@mattermost.com",
		Users:          nUsers,
		TermsAccepted:  true,
		CompanyCountry: "US",
		CompanyName:    "mattermost",
		CompanySize:    "1-10",
		ContactName:    "Matter Most",
	}

	t.Run("permission denied", func(t *testing.T) {
		resp, err := th.Client.RequestTrialLicenseWithExtraFields(context.Background(), &model.TrialLicenseRequest{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("trial license user count less than current users", func(t *testing.T) {
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
		originalCwsUrl := *th.App.Srv().Config().CloudSettings.CWSURL
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = testServer.URL })
		defer func(requestTrialURL string) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = requestTrialURL })
		}(originalCwsUrl)

		cloud.On("ValidateBusinessEmail", mock.Anything, mock.Anything).Return(nil)

		resp, err := th.SystemAdminClient.RequestTrialLicenseWithExtraFields(context.Background(), validTrialRequest)
		CheckErrorID(t, err, "api.license.add_license.unique_users.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("returns status 451 when it receives status 451", func(t *testing.T) {

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

		originalCwsUrl := *th.App.Srv().Config().CloudSettings.CWSURL
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = testServer.URL })
		defer func(requestTrialURL string) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = requestTrialURL })
		}(originalCwsUrl)

		resp, err := th.SystemAdminClient.RequestTrialLicenseWithExtraFields(context.Background(), validTrialRequest)
		require.Error(t, err)
		require.Equal(t, resp.StatusCode, 451)
	})

	t.Run("returns status 400 if request is a mix of legacy and new fields", func(t *testing.T) {
		validTrialRequest.CompanyCountry = ""
		validTrialRequest.Users = 100
		defer func() { validTrialRequest.CompanyCountry = "US" }()
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
		originalCwsUrl := *th.App.Srv().Config().CloudSettings.CWSURL
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = testServer.URL })
		defer func(requestTrialURL string) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = requestTrialURL })
		}(originalCwsUrl)

		cloud.On("ValidateBusinessEmail", mock.Anything, mock.Anything).Return(nil)

		resp, err := th.SystemAdminClient.RequestTrialLicenseWithExtraFields(context.Background(), validTrialRequest)
		CheckErrorID(t, err, "api.license.request-trial.bad-request")
		CheckBadRequestStatus(t, resp)
	})

	th.App.Srv().Platform().SetLicenseManager(nil)
	t.Run("trial license should fail if LicenseManager is nil", func(t *testing.T) {
		resp, err := th.SystemAdminClient.RequestTrialLicenseWithExtraFields(context.Background(), validTrialRequest)
		CheckErrorID(t, err, "api.license.upgrade_needed.app_error")
		CheckForbiddenStatus(t, resp)
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
		resp, err := th.Client.RequestTrialLicense(context.Background(), 1000)
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
		originalCwsUrl := *th.App.Srv().Config().CloudSettings.CWSURL
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = testServer.URL })
		defer func(requestTrialURL string) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = requestTrialURL })
		}(originalCwsUrl)

		resp, err := th.SystemAdminClient.RequestTrialLicense(context.Background(), nUsers)
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

		originalCwsUrl := *th.App.Srv().Config().CloudSettings.CWSURL
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = testServer.URL })
		defer func(requestTrialURL string) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.CloudSettings.CWSURL = requestTrialURL })
		}(originalCwsUrl)

		resp, err := th.SystemAdminClient.RequestTrialLicense(context.Background(), nUsers)
		require.Error(t, err)
		require.Equal(t, resp.StatusCode, 451)
	})

	th.App.Srv().Platform().SetLicenseManager(nil)
	t.Run("trial license should fail if LicenseManager is nil", func(t *testing.T) {
		resp, err := th.SystemAdminClient.RequestTrialLicense(context.Background(), 1)
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
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/license/renewal", "")
		CheckErrorID(t, err, "app.license.generate_renewal_token.no_license")
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestRequestTrueUpReview(t *testing.T) {
	t.Run("returns status 200 when telemetry data sent", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.Srv().SetLicense(model.NewTestLicense())

		th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)

		cloud := mocks.CloudInterface{}
		cloud.Mock.On("SubmitTrueUpReview", mock.Anything, mock.Anything).Return(nil)

		cloudImpl := th.App.Srv().Cloud
		defer func() {
			th.App.Srv().Cloud = cloudImpl
		}()
		th.App.Srv().Cloud = &cloud

		var reviewProfile map[string]any
		resp, err := th.Client.SubmitTrueUpReview(context.Background(), reviewProfile)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("returns 501 when ran by cloud user", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.Srv().SetLicense(model.NewTestLicense())

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		resp, err := th.SystemAdminClient.DoAPIPost(context.Background(), "/license/review", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)

		th.App.Srv().SetLicense(model.NewTestLicense())
	})

	t.Run("returns 403 when user does not have permissions", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.Srv().SetLicense(model.NewTestLicense())

		resp, err := th.Client.DoAPIPost(context.Background(), "/license/review", "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("returns 400 when license is nil", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(nil)

		resp, err := th.SystemAdminClient.DoAPIPost(context.Background(), "/license/review", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

func TestTrueUpReviewStatus(t *testing.T) {
	th := Setup(t)

	defer th.TearDown()
	th.App.Srv().SetLicense(model.NewTestLicense())

	t.Run("returns 200 when status retrieved", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/license/review/status", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("returns 501 when ran by cloud user", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/license/review/status", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)

		th.App.Srv().SetLicense(model.NewTestLicense())
	})

	t.Run("returns 403 when user does not have permissions", func(t *testing.T) {
		resp, err := th.Client.DoAPIGet(context.Background(), "/license/review/status", "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("returns 400 when license is nil", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/license/review/status", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}
