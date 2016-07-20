// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"github.com/mattermost/platform/model"
	"testing"
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

	b2 := []byte("junkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunkjunk")
	if ok, _ := ValidateLicense(b2); ok {
		t.Fatal("should have failed - bad license")
	}
}

func TestClientLicenseEtag(t *testing.T) {
	etag1 := GetClientLicenseEtag()

	ClientLicense["SomeFeature"] = "true"

	etag2 := GetClientLicenseEtag()
	if etag1 == etag2 {
		t.Fatal("etags should not match")
	}

	ClientLicense["SomeFeature"] = "false"

	etag3 := GetClientLicenseEtag()
	if etag2 == etag3 {
		t.Fatal("etags should not match")
	}
}
