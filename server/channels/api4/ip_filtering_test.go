// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func Test_getIPFilters(t *testing.T) {
	lic := &model.License{
		Features: &model.Features{
			CustomPermissionsSchemes: new(false),
			Cloud:                    new(true),
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
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("License but no permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().SetLicense(lic)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("License and permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("GetIPFilters").Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		th.App.Srv().IPFiltering = ipFiltering

		th.App.Srv().SetLicense(lic)

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.NoError(t, err)
		require.NotNil(t, ipFilters)
		require.Equal(t, 200, r.StatusCode)
	})

	t.Run("License and permission but not cloud returns 501", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("GetIPFilters").Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		th.App.Srv().IPFiltering = ipFiltering

		lic.Features.Cloud = new(false)

		th.App.Srv().SetLicense(lic)

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.GetIPFilters(context.Background())
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
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
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("License and permission but not cloud returns 501", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("License but no permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering
		th.App.Srv().SetLicense(lic)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.Error(t, err)
		require.Nil(t, ipFilters)
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("License and permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(lic)

		ipFiltering := &mocks.IPFilteringInterface{}
		ipFiltering.Mock.On("ApplyIPFilters", mock.Anything).Return(&model.AllowedIPRanges{
			model.AllowedIPRange{
				CIDRBlock:   "127.0.0.1/32",
				Description: "test",
			},
		}, nil)
		th.App.Srv().IPFiltering = ipFiltering

		cloud := &mocks.CloudInterface{}
		cloud.Mock.On("GetCloudCustomer", mock.Anything).Return(&model.CloudCustomer{
			CloudCustomerInfo: model.CloudCustomerInfo{Email: "test@localhost"},
		}, nil)

		th.App.Srv().Cloud = cloud

		_, _, err := th.Client.Login(context.Background(), th.SystemAdminUser.Email, th.SystemAdminUser.Password)
		require.NoError(t, err)

		ipFilters, r, err := th.Client.ApplyIPFilters(context.Background(), allowedRanges)
		require.NoError(t, err)
		require.NotNil(t, ipFilters)
		require.Equal(t, 200, r.StatusCode)
	})
}

func Test_getMyIP(t *testing.T) {
	lic := &model.License{
		Features: &model.Features{
			CustomPermissionsSchemes: new(false),
			Cloud:                    new(true),
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
		th := Setup(t).InitBasic(t)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering

		appErr := th.App.Srv().RemoveLicense()
		require.Nil(t, appErr)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		myIP, r, err := th.Client.GetMyIP(context.Background())
		require.Error(t, err)
		require.Nil(t, myIP)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("Licensed but not cloud returns 501", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		myIP, r, err := th.Client.GetMyIP(context.Background())
		require.Error(t, err)
		require.Nil(t, myIP)
		require.Equal(t, 501, r.StatusCode)
	})

	t.Run("Licensed and cloud returns 200", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		_, _, err := th.Client.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		ipFiltering := &mocks.IPFilteringInterface{}
		th.App.Srv().IPFiltering = ipFiltering
		th.App.Srv().SetLicense(lic)

		myIP, r, err := th.Client.GetMyIP(context.Background())
		require.NoError(t, err)
		require.NotNil(t, myIP)
		require.Equal(t, 200, r.StatusCode)
	})
}
