// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net/http"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"
)

var LdapCmd = &cobra.Command{
	Use:   "ldap",
	Short: "LDAP related utilities",
}

var LdapSyncCmd = &cobra.Command{
	Use:     "sync",
	Short:   "Synchronize now",
	Long:    "Synchronize all LDAP users and groups now.",
	Example: "  ldap sync",
	RunE:    withClient(ldapSyncCmdF),
}

var LdapIDMigrate = &cobra.Command{
	Use:   "idmigrate <objectGUID>",
	Short: "Migrate LDAP IdAttribute to new value",
	Long: `Migrate LDAP "IdAttribute" to a new value. Run this utility to change the value of your ID Attribute without your users losing their accounts. After running the command you can change the ID Attribute to the new value in the System Console. For example, if your current ID Attribute was "sAMAccountName" and you wanted to change it to "objectGUID", you would:

1. Wait for an off-peak time when your users won’t be impacted by a server restart.
2. Run the command "mmctl ldap idmigrate objectGUID".
3. Update the config within the System Console to the new value "objectGUID".
4. Restart the Mattermost server.`,
	Example: "  ldap idmigrate objectGUID",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(ldapIDMigrateCmdF),
}

func init() {
	LdapSyncCmd.Flags().Bool("include-removed-members", false, "Include members who left or were removed from a group-synced team/channel")
	LdapCmd.AddCommand(
		LdapSyncCmd,
		LdapIDMigrate,
	)
	RootCmd.AddCommand(LdapCmd)
}

func ldapSyncCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	includeRemovedMembers, _ := cmd.Flags().GetBool("include-removed-members")

	resp, err := c.SyncLdap(includeRemovedMembers)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusOK {
		printer.PrintT("Status: {{.status}}", map[string]interface{}{"status": "ok"})
	} else {
		printer.PrintT("Status: {{.status}}", map[string]interface{}{"status": "error"})
	}

	return nil
}

func ldapIDMigrateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	toAttribute := args[0]
	resp, err := c.MigrateIdLdap(toAttribute)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusOK {
		printer.Print("AD/LDAP IdAttribute migration complete. You can now change your IdAttribute to: " + toAttribute)
	}

	return nil
}
