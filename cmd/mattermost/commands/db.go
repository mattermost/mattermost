// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
	"github.com/mattermost/morph"
	"github.com/mattermost/morph/models"
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

var DowngradeCmd = &cobra.Command{
	Use:   "downgrade",
	Short: "Downgrade the database with the given plan or migration numbers",
	Long:  "Downgrade the database with the given plan or migration numbers.",
	RunE:  downgradeCmdF,
	Args:  cobra.ExactArgs(1),
}

var DBVersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Returns the recent applied version number",
	RunE:  dbVersionCmdF,
}

func init() {
	ResetCmd.Flags().Bool("confirm", false, "Confirm you really want to delete everything and a DB backup has been performed.")
	DBVersionCmd.Flags().Bool("all", false, "Returns all applied migrations")
	MigrateCmd.Flags().Bool("auto-recover", false, "Recover the database to it's existing state after a failed migration.")
	MigrateCmd.Flags().Bool("save-plan", false, "Saves the migration plan to be able to be used in the future.")
	MigrateCmd.Flags().Bool("dry-run", false, "Runs the migration plan without applying it.")

	DowngradeCmd.Flags().Bool("auto-recover", false, "Recover the database to it's existing state after a failed migration.")
	DowngradeCmd.Flags().Bool("dry-run", false, "Runs the migration plan without applying it.")

	DbCmd.AddCommand(
		InitDbCmd,
		ResetCmd,
		MigrateCmd,
		DowngradeCmd,
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
	recoverFlag, _ := command.Flags().GetBool("auto-recover")
	savePlan, _ := command.Flags().GetBool("save-plan")
	dryRun, _ := command.Flags().GetBool("dry-run")
	cfgStore, err := config.NewStoreFromDSN(cfgDSN, true, nil, true)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}
	config := cfgStore.Get()

	migrator, err := sqlstore.NewMigrator(config.SqlSettings, dryRun)
	if err != nil {
		return errors.Wrap(err, "failed to create migrator")
	}
	defer migrator.Close()

	plan, err := migrator.GeneratePlan(recoverFlag)
	if err != nil {
		return errors.Wrap(err, "failed to generate migration plan")
	}

	if len(plan.Migrations) == 0 {
		CommandPrettyPrintln("No migrations to apply.")
		return nil
	}

	if savePlan || recoverFlag {
		backend, err2 := filestore.NewFileBackend(config.FileSettings.ToFileBackendSettings(false, true))
		if err2 != nil {
			return fmt.Errorf("failed to initialize filebackend: %w", err2)
		}

		b, mErr := json.MarshalIndent(plan, "", "  ")
		if mErr != nil {
			return fmt.Errorf("failed to marshal plan: %w", mErr)
		}

		fileName, err2 := migrator.GetFileName(plan)
		if err2 != nil {
			return fmt.Errorf("failed to generate plan file: %w", err2)
		}

		_, err = backend.WriteFile(bytes.NewReader(b), fileName+".json")
		if err != nil {
			return fmt.Errorf("failed to write migration plan: %w", err)
		}

		CommandPrettyPrintln("The migration plan has been saved.")
	}

	err = migrator.MigrateWithPlan(config.SqlSettings, plan, dryRun)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}

	CommandPrettyPrintln("Database successfully migrated")

	return nil
}

func downgradeCmdF(command *cobra.Command, args []string) error {
	cfgDSN := getConfigDSN(command, config.GetEnvironment())
	cfgStore, err := config.NewStoreFromDSN(cfgDSN, true, nil, true)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}
	config := cfgStore.Get()

	dryRun, _ := command.Flags().GetBool("dry-run")
	recoverFlag, _ := command.Flags().GetBool("auto-recover")

	backend, err2 := filestore.NewFileBackend(config.FileSettings.ToFileBackendSettings(false, true))
	if err2 != nil {
		return fmt.Errorf("failed to initialize filebackend: %w", err2)
	}

	migrator, err := sqlstore.NewMigrator(config.SqlSettings, dryRun)
	if err != nil {
		return errors.Wrap(err, "failed to create migrator")
	}
	defer migrator.Close()

	// check if the input is version numbers or a file
	// if the input is given as a file, we assume it's a migration plan
	versions := strings.Split(args[0], ",")
	if _, sErr := strconv.Atoi(versions[0]); sErr == nil {
		CommandPrettyPrintln("Database will be downgraded with the following versions: ", versions)

		err = migrator.DowngradeMigrations(config.SqlSettings, dryRun, versions...)
		if err != nil {
			return errors.Wrap(err, "failed to downgrade migrations")
		}

		CommandPrettyPrintln("Database successfully downgraded")
		return nil
	}

	b, err := backend.ReadFile(args[0])
	if err != nil {
		return fmt.Errorf("failed to read plan: %w", err)
	}

	var plan models.Plan
	err = json.Unmarshal(b, &plan)
	if err != nil {
		return fmt.Errorf("failed to unmarshal plan: %w", err)
	}

	morph.SwapPlanDirection(&plan)
	plan.Auto = recoverFlag

	err = migrator.MigrateWithPlan(config.SqlSettings, &plan, dryRun)
	if err != nil {
		return errors.Wrap(err, "failed to migrate")
	}

	CommandPrettyPrintln("Database successfully downgraded")
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
