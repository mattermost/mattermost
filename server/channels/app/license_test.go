// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestLoadLicense(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.App.Srv().LoadLicense()
	require.Nil(t, th.App.Srv().License(), "shouldn't have a valid license")
}

func TestSaveLicense(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	b1 := []byte("junk")

	_, err := th.App.Srv().SaveLicense(b1)
	require.NotNil(t, err, "shouldn't have saved license")
}

func TestRemoveLicense(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	err := th.App.Srv().RemoveLicense()
	require.Nil(t, err, "should have removed license")
}

func TestSetLicense(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	l1 := &model.License{}
	l1.Features = &model.Features{}
	l1.Customer = &model.Customer{}
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	ok := th.App.Srv().SetLicense(l1)
	require.True(t, ok, "license should have worked")

	l3 := &model.License{}
	l3.Features = &model.Features{}
	l3.Customer = &model.Customer{}
	l3.StartsAt = model.GetMillis() + 10000
	l3.ExpiresAt = model.GetMillis() + 100000
	ok = th.App.Srv().SetLicense(l3)
	require.True(t, ok, "license should have passed")
}

func TestGetSanitizedClientLicense(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	setLicense(th, nil)

	m := th.App.Srv().GetSanitizedClientLicense()

	_, ok := m["Name"]
	assert.False(t, ok)
	_, ok = m["SkuName"]
	assert.False(t, ok)
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
	th.App.Srv().SetLicense(l1)
}
