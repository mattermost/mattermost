// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
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
		if err := ldapI.Syncronize(); err != nil {
			CommandPrintErrorln("ERROR: AD/LDAP Synchronization Failed")
		} else {
			CommandPrettyPrintln("SUCCESS: AD/LDAP Synchronization Complete")
		}
	}

	return nil
}
