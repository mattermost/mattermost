// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"errors"
	"flag"
	"fmt"
	"os"

	"github.com/mattermost/platform/api"
	"github.com/spf13/cobra"

	// Plugins
	_ "github.com/mattermost/platform/model/gitlab"

	// Enterprise Deps
	_ "github.com/dgryski/dgoogauth"
	_ "github.com/go-ldap/ldap"
	_ "github.com/mattermost/rsc/qr"
)

//ENTERPRISE_IMPORTS

func main() {
	var rootCmd = &cobra.Command{
		Use:   "platform",
		Short: "Open source, self-hosted Slack-alternative",
		Long:  `Mattermost offers workplace messaging across web, PC and phones with archiving, search and integration with your existing systems. Documentation available at https://docs.mattermost.com`,
		RunE:  runServerCmd,
	}
	rootCmd.PersistentFlags().StringP("config", "c", "config.json", "Configuration file to use.")

	resetCmd.Flags().Bool("confirm", false, "Confirm you really want to delete everything and a DB backup has been performed.")

	rootCmd.AddCommand(serverCmd, versionCmd, userCmd, teamCmd, licenseCmd, importCmd, resetCmd, channelCmd, rolesCmd, testCmd, ldapCmd)

	flag.Usage = func() {
		rootCmd.Usage()
	}
	parseCmds()

	if flagRunCmds {
		CommandPrintErrorln("---------------------------------------------------------------------------------------------")
		CommandPrintErrorln("DEPRECATED! All previous commands are now deprecated. Run: platform help to see the new ones.")
		CommandPrintErrorln("---------------------------------------------------------------------------------------------")
		doLegacyCommands()
	} else {
		if err := rootCmd.Execute(); err != nil {
			os.Exit(1)
		}
	}
}

var resetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset the database to initial state",
	Long:  "Completely erases the database causing the loss of all data. This will reset Mattermost to its initial state.",
	RunE:  resetCmdF,
}

func resetCmdF(cmd *cobra.Command, args []string) error {
	initDBCommandContextCobra(cmd)

	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag {
		var confirm string
		CommandPrettyPrintln("Have you performed a database backup? (YES/NO): ")
		fmt.Scanln(&confirm)

		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
		CommandPrettyPrintln("Are you sure you want to delete everything? All data will be permanently deleted? (YES/NO): ")
		fmt.Scanln(&confirm)
		if confirm != "YES" {
			return errors.New("ABORTED: You did not answer YES exactly, in all capitals.")
		}
	}

	api.Srv.Store.DropAllTables()
	CommandPrettyPrintln("Database sucessfully reset")

	return nil
}
