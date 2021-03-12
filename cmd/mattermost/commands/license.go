// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"errors"
	"io/ioutil"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v5/audit"
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
	RootCmd.AddCommand(LicenseCmd)
}

func uploadLicenseCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	if len(args) != 1 {
		return errors.New("Enter one license file to upload")
	}

	var fileBytes []byte
	if fileBytes, err = ioutil.ReadFile(args[0]); err != nil {
		return err
	}

	if _, err := a.Srv().SaveLicense(fileBytes); err != nil {
		return err
	}

	CommandPrettyPrintln("Uploaded license file")

	auditRec := a.MakeAuditRecord("uploadLicense", audit.Success)
	auditRec.AddMeta("file", args[0])
	a.LogAuditRec(auditRec, nil)

	return nil
}
