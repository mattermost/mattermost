// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestSetLicense(t *testing.T) {
	l1 := &model.License{}
	l1.Features = &model.Features{}
	l1.Customer = &model.Customer{}
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	if ok := SetLicense(l1); !ok {
		t.Fatal("license should have worked")
	}

	l2 := &model.License{}
	l2.Features = &model.Features{}
	l2.Customer = &model.Customer{}
	l2.StartsAt = model.GetMillis() - 1000
	l2.ExpiresAt = model.GetMillis() - 100
	if ok := SetLicense(l2); ok {
		t.Fatal("license should have failed")
	}

	l3 := &model.License{}
	l3.Features = &model.Features{}
	l3.Customer = &model.Customer{}
	l3.StartsAt = model.GetMillis() + 10000
	l3.ExpiresAt = model.GetMillis() + 100000
	if ok := SetLicense(l3); !ok {
		t.Fatal("license should have passed")
	}
}

func TestValidateLicense(t *testing.T) {
	b1 := []byte("junk")
	if ok, _ := ValidateLicense(b1); ok {
		t.Fatal("should have failed - bad license")
	}

	LoadLicense(b1)

	b2 := []byte("junkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunk")
	if ok, _ := ValidateLicense(b2); ok {
		t.Fatal("should have failed - bad license")
	}
}

func TestClientLicenseEtag(t *testing.T) {
	etag1 := GetClientLicenseEtag(false)

	SetClientLicense(map[string]string{"SomeFeature": "true", "IsLicensed": "true"})

	etag2 := GetClientLicenseEtag(false)
	if etag1 == etag2 {
		t.Fatal("etags should not match")
	}

	SetClientLicense(map[string]string{"SomeFeature": "true", "IsLicensed": "false"})

	etag3 := GetClientLicenseEtag(false)
	if etag2 == etag3 {
		t.Fatal("etags should not match")
	}
}

func TestGetSanitizedClientLicense(t *testing.T) {
	l1 := &model.License{}
	l1.Features = &model.Features{}
	l1.Customer = &model.Customer{}
	l1.Customer.Name = "TestName"
	l1.StartsAt = model.GetMillis() - 1000
	l1.ExpiresAt = model.GetMillis() + 100000
	SetLicense(l1)

	m := GetSanitizedClientLicense()

	if _, ok := m["Name"]; ok {
		t.Fatal("should have been sanatized")
	}
}

func TestGetLicenseFileLocation(t *testing.T) {
	fileName := GetLicenseFileLocation("")
	if len(fileName) == 0 {
		t.Fatal("invalid default file name")
	}

	fileName = GetLicenseFileLocation("mattermost.mattermost-license")
	if fileName != "mattermost.mattermost-license" {
		t.Fatal("invalid file name")
	}
}

func TestGetLicenseFileFromDisk(t *testing.T) {
	fileBytes := GetLicenseFileFromDisk("thisfileshouldnotexist.mattermost-license")
	if len(fileBytes) > 0 {
		t.Fatal("invalid bytes")
	}

	fileBytes = GetLicenseFileFromDisk(FindConfigFile("config.json"))
	if len(fileBytes) == 0 { // a valid bytes but should be a fail license
		t.Fatal("invalid bytes")
	}

	if success, _ := ValidateLicense(fileBytes); success {
		t.Fatal("should have been an invalid file")
	}
}
