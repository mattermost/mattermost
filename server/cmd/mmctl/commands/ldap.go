// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

var LdapCmd = &cobra.Command{
	Use:   "ldap",
	Short: "LDAP related utilities",
}

func newLDAPSyncCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "sync",
		Short:   "Synchronize now",
		Long:    "Synchronize all LDAP users and groups now.",
		Example: "  ldap sync",
		RunE:    withClient(ldapSyncCmdF),
	}

	cmd.Flags().Bool("include-removed-members", false, "Include members who left or were removed from a group-synced team/channel")
	err := cmd.Flags().MarkDeprecated("include-removed-members", "This flag is deprecated and will be removed in a future version. Use LdapSettings.ReAddRemovedMembers instead.")
	if err != nil {
		panic(err)
	}

	return cmd
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

var LdapJobCmd = &cobra.Command{
	Use:   "job",
	Short: "List and show LDAP sync jobs",
}

var LdapJobListCmd = &cobra.Command{
	Use:     "list",
	Example: "  ldap job list",
	Short:   "List LDAP sync jobs",
	// Alisases cause error in zsh. Supposedly, completion V2 will fix that: https://github.com/spf13/cobra/pull/1146
	// https://mattermost.atlassian.net/browse/MM-57062
	// Aliases: []string{"ls"},
	Args:              cobra.NoArgs,
	ValidArgsFunction: noCompletion,
	RunE:              withClient(ldapJobListCmdF),
}

var LdapJobShowCmd = &cobra.Command{
	Use:               "show [ldapJobID]",
	Example:           " import ldap show f3d68qkkm7n8xgsfxwuo498rah",
	Short:             "Show LDAP sync job",
	ValidArgsFunction: validateArgsWithClient(ldapJobShowCompletionF),
	RunE:              withClient(ldapJobShowCmdF),
}

func init() {
	ldapSyncCmd := newLDAPSyncCmd()

	LdapJobListCmd.Flags().Int("page", 0, "Page number to fetch for the list of import jobs")
	LdapJobListCmd.Flags().Int("per-page", 200, "Number of import jobs to be fetched")
	LdapJobListCmd.Flags().Bool("all", false, "Fetch all import jobs. --page flag will be ignore if provided")

	LdapJobCmd.AddCommand(
		LdapJobListCmd,
		LdapJobShowCmd,
	)

	LdapCmd.AddCommand(
		ldapSyncCmd,
		LdapIDMigrate,
		LdapJobCmd,
	)
	RootCmd.AddCommand(LdapCmd)
}

func ldapSyncCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	var resp *model.Response
	var err error
	if cmd.Flags().Changed("include-removed-members") {
		reAddRemovedMembers, _ := cmd.Flags().GetBool("include-removed-members")
		resp, err = c.SyncLdap(context.TODO(), &reAddRemovedMembers)
	} else {
		resp, err = c.SyncLdap(context.TODO(), nil)
	}
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusOK {
		printer.PrintT("Status: {{.status}}", map[string]any{"status": "ok"})
	} else {
		printer.PrintT("Status: {{.status}}", map[string]any{"status": "error"})
	}

	return nil
}

func ldapIDMigrateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	toAttribute := args[0]
	resp, err := c.MigrateIdLdap(context.TODO(), toAttribute)
	if err != nil {
		return err
	}

	if resp.StatusCode == http.StatusOK {
		printer.Print("AD/LDAP IdAttribute migration complete. You can now change your IdAttribute to: " + toAttribute)
	}

	return nil
}

func ldapJobListCmdF(c client.Client, command *cobra.Command, args []string) error {
	return jobListCmdF(c, command, model.JobTypeLdapSync, "")
}

func ldapJobShowCmdF(c client.Client, command *cobra.Command, args []string) error {
	job, _, err := c.GetJob(context.TODO(), args[0])
	if err != nil {
		return fmt.Errorf("failed to get LDAP sync job: %w", err)
	}

	printJob(job)

	return nil
}

func ldapJobShowCompletionF(ctx context.Context, c client.Client, cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	return fetchAndComplete(
		func(ctx context.Context, c client.Client, page, perPage int) ([]*model.Job, *model.Response, error) {
			return c.GetJobsByType(ctx, model.JobTypeLdapSync, page, perPage)
		},
		func(t *model.Job) []string { return []string{t.Id} },
	)(ctx, c, cmd, args, toComplete)
}
