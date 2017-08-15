// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	//"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestLoadLicense(t *testing.T) {
	Setup()

	LoadLicense()
	if utils.IsLicensed() {
		t.Fatal("shouldn't have a valid license")
	}
}

func TestSaveLicense(t *testing.T) {
	Setup()

	b1 := []byte("junk")

	if _, err := SaveLicense(b1); err == nil {
		t.Fatal("shouldn't have saved license")
	}
}

func TestRemoveLicense(t *testing.T) {
	Setup()

	if err := RemoveLicense(); err != nil {
		t.Fatal("should have removed license")
	}
}
