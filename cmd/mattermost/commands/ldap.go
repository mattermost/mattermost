// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
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

var LdapIdMigrate = &cobra.Command{
	Use:     "idmigrate",
	Short:   "Migrate LDAP IdAttribute to new value",
	Long:    "Migrate LDAP IdAttribute to new value. Run this utility then change the IdAttribute to the new value.",
	Example: " ldap idmigrate objectGUID",
	Args:    cobra.ExactArgs(1),
	RunE:    ldapIdMigrateCmdF,
}

func init() {
	LdapCmd.AddCommand(
		LdapSyncCmd,
		LdapIdMigrate,
	)
	RootCmd.AddCommand(LdapCmd)
}

func ldapSyncCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

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

func ldapIdMigrateCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	toAttribute := args[0]
	if ldapI := a.Ldap; ldapI != nil {
		if err := ldapI.MigrateIDAttribute(toAttribute); err != nil {
			CommandPrintErrorln("ERROR: AD/LDAP IdAttribute migration failed! Error: " + err.Error())
		} else {
			CommandPrettyPrintln("SUCCESS: AD/LDAP IdAttribute migration complete. You can now change your IdAttribute to: " + toAttribute)
		}
	}

	return nil
}
