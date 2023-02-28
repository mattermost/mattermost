// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"strconv"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v6/channels/app"
	"github.com/mattermost/mattermost-server/v6/channels/audit"
	"github.com/mattermost/mattermost-server/v6/channels/config"
	"github.com/mattermost/mattermost-server/v6/channels/store/sqlstore"
)

var DbCmd = &cobra.Command{
	Use:   "db",
	Short: "Commands related to the database",
}

var InitDbCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize the database",
	Long: `Initialize the database for a given DSN, executing the migrations and loading the custom defaults if any.

This command should be run using a database configuration DSN.`,
	Example: `  # you can use the config flag to pass the DSN
  $ mattermost db init --config postgres://localhost/mattermost

  # or you can use the MM_CONFIG environment variable
  $ MM_CONFIG=postgres://localhost/mattermost mattermost db init

  # and you can set a custom defaults file to be loaded into the database
  $ MM_CUSTOM_DEFAULTS_PATH=custom.json MM_CONFIG=postgres://localhost/mattermost mattermost db init`,
	Args: cobra.NoArgs,
	RunE: initDbCmdF,
}

var ResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset the database to initial state",
	Long:  "Completely erases the database causing the loss of all data. This will reset Mattermost to its initial state.",
	RunE:  resetCmdF,
}

var MigrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Migrate the database if there are any unapplied migrations",
	Long:  "Run the missing migrations from the migrations table.",
	RunE:  migrateCmdF,
}

var DBVersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Returns the recent applied version number",
	RunE:  dbVersionCmdF,
}

func init() {
	ResetCmd.Flags().Bool("confirm", false, "Confirm you really want to delete everything and a DB backup has been performed.")
	DBVersionCmd.Flags().Bool("all", false, "Returns all applied migrations")

	DbCmd.AddCommand(
		InitDbCmd,
		ResetCmd,
		MigrateCmd,
		DBVersionCmd,
	)

	RootCmd.AddCommand(
		DbCmd,
	)
}

func initDbCmdF(command *cobra.Command, _ []string) error {
	dsn := getConfigDSN(command, config.GetEnvironment())
	if !config.IsDatabaseDSN(dsn) {
		return errors.New("this command should be run using a database configuration DSN")
	}

	customDefaults, err := loadCustomDefaults()
	if err != nil {
		return errors.Wrap(err, "error loading custom configuration defaults")
	}

	configStore, err := config.NewStoreFromDSN(getConfigDSN(command, config.GetEnvironment()), false, customDefaults, true)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}
	defer configStore.Close()

	sqlStore := sqlstore.New(configStore.Get().SqlSettings, nil)
	defer sqlStore.Close()

	fmt.Println("Database store correctly initialised")

	return nil
}

func resetCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command, app.SkipPostInitialization())
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	confirmFlag, _ := command.Flags().GetBool("confirm")
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

	a.Srv().Store().DropAllTables()
	CommandPrettyPrintln("Database successfully reset")

	auditRec := a.MakeAuditRecord("reset", audit.Success)
	a.LogAuditRec(auditRec, nil)

	return nil
}

func migrateCmdF(command *cobra.Command, args []string) error {
	cfgDSN := getConfigDSN(command, config.GetEnvironment())
	cfgStore, err := config.NewStoreFromDSN(cfgDSN, true, nil, true)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}
	config := cfgStore.Get()

	store := sqlstore.New(config.SqlSettings, nil)
	defer store.Close()

	CommandPrettyPrintln("Database successfully migrated")

	return nil
}

func dbVersionCmdF(command *cobra.Command, args []string) error {
	cfgDSN := getConfigDSN(command, config.GetEnvironment())
	cfgStore, err := config.NewStoreFromDSN(cfgDSN, true, nil, true)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}
	config := cfgStore.Get()

	store := sqlstore.New(config.SqlSettings, nil)
	defer store.Close()

	allFlag, _ := command.Flags().GetBool("all")
	if allFlag {
		applied, err2 := store.GetAppliedMigrations()
		if err2 != nil {
			return errors.Wrap(err2, "failed to get applied migrations")
		}
		for _, migration := range applied {
			CommandPrettyPrintln(fmt.Sprintf("Varsion: %d, Name: %s", migration.Version, migration.Name))
		}
		return nil
	}

	v, err := store.GetDBSchemaVersion()
	if err != nil {
		return errors.Wrap(err, "failed to get schema version")
	}
	CommandPrettyPrintln("Current database schema version is: " + strconv.Itoa(v))

	return nil
}
