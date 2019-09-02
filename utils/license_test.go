// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	t.Run("missing file", func(t *testing.T) {
		fileBytes := GetLicenseFileFromDisk("thisfileshouldnotexist.mattermost-license")
		assert.Empty(t, fileBytes, "invalid bytes")
	})

	t.Run("not a license file", func(t *testing.T) {
		f, err := ioutil.TempFile("", "TestGetLicenseFileFromDisk")
		require.NoError(t, err)
		defer os.Remove(f.Name())
		ioutil.WriteFile(f.Name(), []byte("not a license"), 0777)

		fileBytes := GetLicenseFileFromDisk(f.Name())
		require.NotEmpty(t, fileBytes, "should have read the file")

		success, _ := ValidateLicense(fileBytes)
		assert.False(t, success, "should have been an invalid file")
	})
}
