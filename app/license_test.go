// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.LoadLicense()
	require.Nil(t, th.App.License(), "shouldn't have a valid license")
}

func TestSaveLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	b1 := []byte("junk")

	_, err := th.App.SaveLicense(b1)
	require.NotNil(t, err, "shouldn't have saved license")
}

func TestRemoveLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	err := th.App.RemoveLicense()
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
	ok := th.App.SetLicense(l1)
	require.True(t, ok, "license should have worked")

	l3 := &model.License{}
	l3.Features = &model.Features{}
	l3.Customer = &model.Customer{}
	l3.StartsAt = model.GetMillis() + 10000
	l3.ExpiresAt = model.GetMillis() + 100000
	ok = th.App.SetLicense(l3)
	require.True(t, ok, "license should have passed")
}

func TestGetSanitizedClientLicense(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	l1 := &model.License{}
	l1.Features = &model.Features{}
	l1.Customer = &model.Customer{}
	l1.Customer.Name = "TestName"
	l1.SkuName = "SKU NAME"
	l1.SkuShortName = "SKU SHORT NAME"
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	th.App.SetLicense(l1)

	m := th.App.GetSanitizedClientLicense()

	_, ok := m["Name"]
	assert.False(t, ok)
	_, ok = m["SkuName"]
	assert.False(t, ok)
	_, ok = m["SkuShortName"]
	assert.False(t, ok)
}
