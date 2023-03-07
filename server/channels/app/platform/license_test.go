// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/model"
)

func TestLoadLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.Service.LoadLicense()
	require.Nil(t, th.Service.License(), "shouldn't have a valid license")
}

func TestSaveLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	b1 := []byte("junk")

	_, err := th.Service.SaveLicense(b1)
	require.NotNil(t, err, "shouldn't have saved license")
}

func TestRemoveLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	err := th.Service.RemoveLicense()
	require.Nil(t, err, "should have removed license")
}

func TestSetLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	l1 := &model.License{}
	l1.Features = &model.Features{}
	l1.Customer = &model.Customer{}
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	ok := th.Service.SetLicense(l1)
	require.True(t, ok, "license should have worked")

	l3 := &model.License{}
	l3.Features = &model.Features{}
	l3.Customer = &model.Customer{}
	l3.StartsAt = model.GetMillis() + 10000
	l3.ExpiresAt = model.GetMillis() + 100000
	ok = th.Service.SetLicense(l3)
	require.True(t, ok, "license should have passed")
}

func TestGetSanitizedClientLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	setLicense(th, nil)

	m := th.Service.GetSanitizedClientLicense()

	_, ok := m["Name"]
	assert.False(t, ok)
	_, ok = m["SkuName"]
	assert.False(t, ok)
	_, ok = m["SkuShortName"]
	assert.False(t, ok)
}

func TestGenerateRenewalToken(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("renewal token generated correctly", func(t *testing.T) {
		setLicense(th, nil)
		token, appErr := th.Service.GenerateRenewalToken(JWTDefaultTokenExpiration)
		require.Nil(t, appErr)
		require.NotEmpty(t, token)
	})

	t.Run("return error if there is no active license", func(t *testing.T) {
		th.Service.SetLicense(nil)
		_, appErr := th.Service.GenerateRenewalToken(JWTDefaultTokenExpiration)
		require.NotNil(t, appErr)
	})
}

func setLicense(th *TestHelper, customer *model.Customer) {
	l1 := &model.License{}
	l1.Features = &model.Features{}
	if customer != nil {
		l1.Customer = customer
	} else {
		l1.Customer = &model.Customer{}
		l1.Customer.Name = "TestName"
		l1.Customer.Email = "test@example.com"
	}
	l1.SkuName = "SKU NAME"
	l1.SkuShortName = "SKU SHORT NAME"
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	th.Service.SetLicense(l1)
}
