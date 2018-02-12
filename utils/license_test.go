// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"
)

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
