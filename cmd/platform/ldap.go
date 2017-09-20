// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var ldapCmd = &cobra.Command{
	Use:   "ldap",
	Short: "LDAP related utilities",
}

var ldapSyncCmd = &cobra.Command{
	Use:     "sync",
	Short:   "Synchronize now",
	Long:    "Synchronize all LDAP users now.",
	Example: "  ldap sync",
	RunE:    ldapSyncCmdF,
}

func init() {
	ldapCmd.AddCommand(
		ldapSyncCmd,
	)
}

func ldapSyncCmdF(cmd *cobra.Command, args []string) error {
	a, err := initDBCommandContextCobra(cmd)
	if err != nil {
		return err
	}

	if ldapI := a.Ldap; ldapI != nil {
		job, err := ldapI.StartSynchronizeJob(true)
		if err != nil || job.Status == model.JOB_STATUS_ERROR || job.Status == model.JOB_STATUS_CANCELED {
			CommandPrintErrorln("ERROR: AD/LDAP Synchronization please check the server logs")
		} else {
			CommandPrettyPrintln("SUCCESS: AD/LDAP Synchronization Complete")
		}
	}

	return nil
}
