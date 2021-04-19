// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/migrations"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/spf13/cobra"
)

var PupulateThreadsCmd = &cobra.Command{
	Use:   "populate-threads",
	Short: "Populate collapsed threads",
	Long:  "Re-index all posts and populate/follow threads",
	RunE:  populateThreadsCmd,
}

func init() {
	RootCmd.AddCommand(PupulateThreadsCmd)
}

func populateThreadsCmd(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()
	data := map[string]string{
		migrations.JobDataKeyMigration:           model.MIGRATION_KEY_POPULATE_THREADS,
		migrations.JobDataKeyMigration_LAST_DONE: "",
	}

	job, appErr := a.Srv().Jobs.CreateJob(model.JOB_TYPE_MIGRATIONS, data)

	if appErr != nil {
		CommandPrintErrorln("Unable to create job. Error: " + appErr.Error())
		return nil
	}

	CommandPrettyPrintln(fmt.Sprintf("SUCCESS: job started with id %v", job.Id))

	return nil
}
