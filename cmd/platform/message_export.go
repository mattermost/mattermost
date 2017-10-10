// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/model"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export data from Mattermost",
}

var actianceExportCmd = &cobra.Command{
	Use:     "actiance",
	Short:   "Actiance XML",
	Long:    "Export data in the Actiance XML format.",
	Example: "  export actiance",
	RunE:    actianceExportCmdF,
}

func init() {
	exportCmd.AddCommand(
		actianceExportCmd,
	)
}

func actianceExportCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	l4g.Debug("CLI command executed")

	if exportInterface := a.Export; exportInterface != nil {
		job, err := exportInterface.StartSynchronizeJob(true)
		if err != nil || job.Status == model.JOB_STATUS_ERROR || job.Status == model.JOB_STATUS_CANCELED {
			CommandPrintErrorln("ERROR: Actiance data export failed. Please check the server logs")
		} else {
			CommandPrettyPrintln("SUCCESS: Actiance data export complete")
		}
	}

	return nil
}
