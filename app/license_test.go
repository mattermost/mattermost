// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	//"github.com/mattermost/mattermost-server/model"
	"testing"

	"github.com/mattermost/mattermost-server/utils"
)

func TestLoadLicense(t *testing.T) {
	a := Global()
	a.Setup()

	a.LoadLicense()
	if utils.IsLicensed() {
		t.Fatal("shouldn't have a valid license")
	}
}

func TestSaveLicense(t *testing.T) {
	a := Global()
	a.Setup()

	b1 := []byte("junk")

	if _, err := a.SaveLicense(b1); err == nil {
		t.Fatal("shouldn't have saved license")
	}
}

func TestRemoveLicense(t *testing.T) {
	a := Global()
	a.Setup()

	if err := a.RemoveLicense(); err != nil {
		t.Fatal("should have removed license")
	}
}
