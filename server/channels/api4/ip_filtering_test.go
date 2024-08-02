// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package api4

import (
	"context"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func Test_getIPFilters(t *testing.T) {
	lic := &model.License{
		Features: &model.Features{
			CustomPermissionsSchemes: model.NewBool(false),
			Cloud:                    model.NewBool(true),
		},
		Customer: &model.Customer{
			Name:  "TestName",
			Email: "test@example.com",
		},
		SkuName:      "SKU NAME",
		SkuShortName: model.LicenseShortSkuEnterprise,
		StartsAt:     model.GetMillis() - 1000,
		ExpiresAt:    model.GetMillis() + 100000,
	}

	t.Run("No license returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().RemoveLicense()

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("No feature flag returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().SetLicense(lic)

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("Feature flag and license but no permission", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().SetLicense(lic)

		th.Client.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("Feature flag and license and permission", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("GetIPFilters").Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().SetLicense(lic)

		th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.NoError(t, err)
		require.NotNil(t, ipFilters)
		require.Equal(t, 200, r.StatusCode)
	})
}

func Test_applyIPFilters(t *testing.T) {
	allowedRanges := &model.AllowedIPRanges{
		model.AllowedIPRange{
			CIDRBlock:   "127.0.0.1/32",
			Description: "test",
		},
	}

	lic := model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "cloud")
	lic.Id = "testlicenseid"

	// Initialize the allowedRanges variable
	t.Run("No license returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().RemoveLicense()

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("License but no feature flag returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering
		th.App.Srv().SetLicense(lic)

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("feature flag and license but no permission", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering
		th.App.Srv().SetLicense(lic)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("Feature flag and license and permission", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(lic)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("ApplyIPFilters", mock.Anything).Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering

		cloud := &mocks.CloudInterface{}
		cloud.Mock.On("GetCloudCustomer", mock.Anything).Return(&model.CloudCustomer{
			CloudCustomerInfo: model.CloudCustomerInfo{Email: "test@localhost"},
		}, nil)

		th.App.Srv().Cloud = cloud

		th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.NoError(t, err)
		require.NotNil(t, ipFilters)
		require.Equal(t, 200, r.StatusCode)
	})
}

func Test_getMyIP(t *testing.T) {
	lic := &model.License{
		Features: &model.Features{
			CustomPermissionsSchemes: model.NewBool(false),
			Cloud:                    model.NewBool(true),
		},
		Customer: &model.Customer{
			Name:  "TestName",
			Email: "test@example.com",
		},
		SkuName:      "SKU NAME",
		SkuShortName: model.LicenseShortSkuEnterprise,
		StartsAt:     model.GetMillis() - 1000,
		ExpiresAt:    model.GetMillis() + 100000,
	}
	t.Run("No license returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().RemoveLicense()

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		myIP, r, err := th.Client.GetMyIP(context.Background())
		require.Error(t, err)
		require.Nil(t, myIP)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("Licensed, but no feature flag returns 501", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CLOUDIPFILTERING", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CLOUDIPFILTERING")
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFilteringImpl := th.App.Srv().IPFiltering
		defer func() {
			th.App.Srv().IPFiltering = ipFilteringImpl
		}()
		th.App.Srv().IPFiltering = ipFiltering
		th.App.Srv().SetLicense(lic)

		myIP, r, err := th.Client.GetMyIP(context.Background())
		require.Error(t, err)
		require.Nil(t, myIP)
		require.Equal(t, 501, r.StatusCode)
	})
}
