// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"net/http"
	"os"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

const (
	fakeLicensePayload = "This is the license."
)

func (s *MmctlUnitTestSuite) TestRemoveLicenseCmd() {
	s.Run("Remove license successfully", func() {
		printer.Clean()

		s.client.
			EXPECT().
			RemoveLicenseFile(context.TODO()).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := removeLicenseCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(printer.GetLines()[0], "Removed license")
	})

	s.Run("Fail to remove license", func() {
		printer.Clean()
		mockErr := errors.New("mock error")

		s.client.
			EXPECT().
			RemoveLicenseFile(context.TODO()).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockErr).
			Times(1)

		err := removeLicenseCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(err, mockErr)
	})
}

func (s *MmctlUnitTestSuite) TestUploadLicenseCmdF() {
	// create temporary file
	tmpFile, err := os.CreateTemp(os.TempDir(), "testLicense-")
	s.NoError(err)

	text := []byte(fakeLicensePayload)
	_, err = tmpFile.Write(text)
	s.NoError(err)
	defer os.Remove(tmpFile.Name())

	mockLicenseFile := []byte(fakeLicensePayload)

	s.Run("Upload license successfully", func() {
		printer.Clean()
		s.client.
			EXPECT().
			UploadLicenseFile(context.TODO(), mockLicenseFile).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := uploadLicenseCmdF(s.client, &cobra.Command{}, []string{tmpFile.Name()})
		s.Require().Nil(err)
	})

	s.Run("Fail to upload license if file not found", func() {
		printer.Clean()
		path := "/path/to/nonexistentfile"
		errMsg := "open " + path + ": no such file or directory"
		s.client.
			EXPECT().
			UploadLicenseFile(context.TODO(), mockLicenseFile).
			Times(0)

		err := uploadLicenseCmdF(s.client, &cobra.Command{}, []string{path})
		s.Require().EqualError(err, errMsg)
	})

	s.Run("Fail to upload license if no path is given", func() {
		printer.Clean()
		err := uploadLicenseCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().EqualError(err, "enter one license file to upload")
	})
}

func (s *MmctlUnitTestSuite) TestUploadLicenseStringCmdF() {
	// create temporary file
	licenseString := string(fakeLicensePayload)

	mockLicenseFile := []byte(fakeLicensePayload)

	s.Run("Upload license successfully", func() {
		printer.Clean()
		s.client.
			EXPECT().
			UploadLicenseFile(context.TODO(), mockLicenseFile).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := uploadLicenseStringCmdF(s.client, &cobra.Command{}, []string{licenseString})
		s.Require().Nil(err)
	})

	s.Run("Fail to upload license if no license string is given", func() {
		printer.Clean()
		err := uploadLicenseStringCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().EqualError(err, "enter one license file to upload")
	})
}

func (s *MmctlUnitTestSuite) TestGetLicenseCmdF() {
	s.Run("Get license successfully", func() {
		printer.Clean()

		mockLicense := map[string]string{
			"IsLicensed":   "true",
			"Id":           "test-license-id",
			"Company":      "Test Company",
			"Name":         "Test Contact",
			"Email":        "test@example.com",
			"SkuShortName": "enterprise",
			"Users":        "100",
			"IssuedAt":     "1609459200000",
			"StartsAt":     "1609459200000",
			"ExpiresAt":    "1640995200000",
			"IsTrial":      "false",
		}

		s.client.
			EXPECT().
			GetOldClientLicense(context.TODO(), "").
			Return(mockLicense, &model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := getLicenseCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		// Verify human-readable dates are formatted correctly
		output := printer.GetLines()[0].(map[string]string)
		s.Equal("2021-01-01T00:00:00Z", output["IssuedAtReadable"])
		s.Equal("2021-01-01T00:00:00Z", output["StartsAtReadable"])
		s.Equal("2022-01-01T00:00:00Z", output["ExpiresAtReadable"])
		s.Equal("Test Company", output["Company"])
		s.Equal("enterprise", output["SkuShortName"])
	})

	s.Run("No license installed", func() {
		printer.Clean()

		mockLicense := map[string]string{
			"IsLicensed": "false",
		}

		s.client.
			EXPECT().
			GetOldClientLicense(context.TODO(), "").
			Return(mockLicense, &model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := getLicenseCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "No license installed")
	})

	s.Run("Fail to get license", func() {
		printer.Clean()
		mockErr := errors.New("mock error")

		s.client.
			EXPECT().
			GetOldClientLicense(context.TODO(), "").
			Return(nil, &model.Response{StatusCode: http.StatusInternalServerError}, mockErr).
			Times(1)

		err := getLicenseCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NotNil(err)
		s.Require().Equal(err, mockErr)
		s.Require().Len(printer.GetLines(), 0)
	})
}
