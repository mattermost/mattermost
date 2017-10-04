// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	//"github.com/mattermost/mattermost-server/model"
	"testing"

	"github.com/mattermost/mattermost-server/utils"
)

func TestLoadLicense(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.LoadLicense()
	if utils.IsLicensed() {
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
