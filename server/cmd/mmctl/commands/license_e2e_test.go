// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"
	"os"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestRemoveLicenseCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

	s.Require().True(s.th.App.Srv().SetLicense(model.NewTestLicense()))

	s.Run("MM-T3955 Should fail when regular user attempts to remove the server license", func() {
		printer.Clean()

		err := removeLicenseCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3954 Should be able to remove the server license", func(c client.Client) {
		printer.Clean()

		err := removeLicenseCmdF(c, &cobra.Command{}, nil)
		s.Require().NoError(err)
		defer func() {
			s.Require().True(s.th.App.Srv().SetLicense(model.NewTestLicense()))
		}()
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], "Removed license")
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Nil(s.th.App.Srv().License())
	})
}

func (s *MmctlE2ETestSuite) TestUploadLicenseCmdF() {
	s.SetupEnterpriseTestHelper().InitBasic()

	// create temporary file
	tmpFile, err := os.CreateTemp(os.TempDir(), "testLicense-")
	s.Require().NoError(err)

	license := model.NewTestLicense()
	b, err := json.Marshal(license)
	s.Require().NoError(err)

	_, err = tmpFile.Write(b)
	s.Require().NoError(err)
	s.T().Cleanup(func() {
		os.Remove(tmpFile.Name())
	})

	s.Run("MM-T3953 Should fail when regular user attempts to upload a license file", func() {
		printer.Clean()

		err := uploadLicenseCmdF(s.th.Client, &cobra.Command{}, []string{tmpFile.Name()})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3952 Should be able to upload a license file, fail on validation", func(c client.Client) {
		printer.Clean()

		err := uploadLicenseCmdF(c, &cobra.Command{}, []string{tmpFile.Name()})
		s.Require().Error(err)
		appErr, ok := err.(*model.AppError)
		s.Require().True(ok)
		s.Require().Equal(appErr.Message, "Invalid license file.")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}
