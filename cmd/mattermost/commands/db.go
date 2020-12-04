// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
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
  $ MM_CONFIG=postgres://localhost/mattermost mattermost db init`,
	Args: cobra.NoArgs,
	RunE: initDbCmdF,
}

func init() {
	DbCmd.AddCommand(
		InitDbCmd,
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

	configStore, err := config.NewStore(getConfigDSN(command, config.GetEnvironment()), false, customDefaults)
	if err != nil {
		return errors.Wrap(err, "failed to load configuration")
	}
	defer configStore.Close()

	sqlStore := sqlstore.New(configStore.Get().SqlSettings, nil)
	defer sqlStore.Close()

	fmt.Println("Database store correctly initialised")

	return nil
}
