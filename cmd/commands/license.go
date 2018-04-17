// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"io/ioutil"

	"github.com/mattermost/mattermost-server/cmd"
	"github.com/spf13/cobra"
)

var LicenseCmd = &cobra.Command{
	Use:   "license",
	Short: "Licensing commands",
}

var UploadLicenseCmd = &cobra.Command{
	Use:     "upload [license]",
	Short:   "Upload a license.",
	Long:    "Upload a license. Replaces current license.",
	Example: "  license upload /path/to/license/mylicensefile.mattermost-license",
	RunE:    uploadLicenseCmdF,
}

func init() {
	LicenseCmd.AddCommand(UploadLicenseCmd)
	cmd.RootCmd.AddCommand(LicenseCmd)
}

func uploadLicenseCmdF(command *cobra.Command, args []string) error {
	a, err := cmd.InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) != 1 {
		return errors.New("Enter one license file to upload")
	}

	var fileBytes []byte
	if fileBytes, err = ioutil.ReadFile(args[0]); err != nil {
		return err
	}

	if _, err := a.SaveLicense(fileBytes); err != nil {
		return err
	}

	cmd.CommandPrettyPrintln("Uploaded license file")

	return nil
}
