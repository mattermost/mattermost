// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/cmd"
	"github.com/mattermost/mattermost-server/model"
	"github.com/spf13/cobra"
)

var LdapCmd = &cobra.Command{
	Use:   "ldap",
	Short: "LDAP related utilities",
}

var LdapSyncCmd = &cobra.Command{
	Use:     "sync",
	Short:   "Synchronize now",
	Long:    "Synchronize all LDAP users now.",
	Example: "  ldap sync",
	RunE:    ldapSyncCmdF,
}

func init() {
	LdapCmd.AddCommand(
		LdapSyncCmd,
	)
	cmd.RootCmd.AddCommand(LdapCmd)
}

func ldapSyncCmdF(command *cobra.Command, args []string) error {
	a, err := cmd.InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if ldapI := a.Ldap; ldapI != nil {
		job, err := ldapI.StartSynchronizeJob(true)
		if err != nil || job.Status == model.JOB_STATUS_ERROR || job.Status == model.JOB_STATUS_CANCELED {
			cmd.CommandPrintErrorln("ERROR: AD/LDAP Synchronization please check the server logs")
		} else {
			cmd.CommandPrettyPrintln("SUCCESS: AD/LDAP Synchronization Complete")
		}
	}

	return nil
}
