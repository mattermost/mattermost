// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestLoadLicense(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.LoadLicense()
	if th.App.License() != nil {
		t.Fatal("shouldn't have a valid license")
	}
}

func TestSaveLicense(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	b1 := []byte("junk")

	if _, err := th.App.SaveLicense(b1); err == nil {
		t.Fatal("shouldn't have saved license")
	}
}

func TestRemoveLicense(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	if err := th.App.RemoveLicense(); err != nil {
		t.Fatal("should have removed license")
	}
}

func TestSetLicense(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	l1 := &model.License{}
	l1.Features = &model.Features{}
	l1.Customer = &model.Customer{}
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	if ok := th.App.SetLicense(l1); !ok {
		t.Fatal("license should have worked")
	}

	l2 := &model.License{}
	l2.Features = &model.Features{}
	l2.Customer = &model.Customer{}
	l2.StartsAt = model.GetMillis() - 1000
	l2.ExpiresAt = model.GetMillis() - 100
	if ok := th.App.SetLicense(l2); ok {
		t.Fatal("license should have failed")
	}

	l3 := &model.License{}
	l3.Features = &model.Features{}
	l3.Customer = &model.Customer{}
	l3.StartsAt = model.GetMillis() + 10000
	l3.ExpiresAt = model.GetMillis() + 100000
	if ok := th.App.SetLicense(l3); !ok {
		t.Fatal("license should have passed")
	}
}

func TestClientLicenseEtag(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	etag1 := th.App.GetClientLicenseEtag(false)

	th.App.SetClientLicense(map[string]string{"SomeFeature": "true", "IsLicensed": "true"})

	etag2 := th.App.GetClientLicenseEtag(false)
	if etag1 == etag2 {
		t.Fatal("etags should not match")
	}

	th.App.SetClientLicense(map[string]string{"SomeFeature": "true", "IsLicensed": "false"})

	etag3 := th.App.GetClientLicenseEtag(false)
	if etag2 == etag3 {
		t.Fatal("etags should not match")
	}
}

func TestGetSanitizedClientLicense(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	l1 := &model.License{}
	l1.Features = &model.Features{}
	l1.Customer = &model.Customer{}
	l1.Customer.Name = "TestName"
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	th.App.SetLicense(l1)

	m := th.App.GetSanitizedClientLicense()

	if _, ok := m["Name"]; ok {
		t.Fatal("should have been sanatized")
	}
}
