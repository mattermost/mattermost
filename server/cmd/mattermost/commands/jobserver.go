// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/config"
)

var JobserverCmd = &cobra.Command{
	Use:   "jobserver",
	Short: "Start the Mattermost job server",
	RunE:  jobserverCmdF,
}

func init() {
	JobserverCmd.Flags().Bool("nojobs", false, "Do not run jobs on this jobserver.")
	JobserverCmd.Flags().Bool("noschedule", false, "Do not schedule jobs from this jobserver.")

	RootCmd.AddCommand(JobserverCmd)
}

func jobserverCmdF(command *cobra.Command, args []string) error {
	// Options
	noJobs, _ := command.Flags().GetBool("nojobs")
	noSchedule, _ := command.Flags().GetBool("noschedule")

	// Initialize
	a, err := initDBCommandContext(getConfigDSN(command, config.GetEnvironment()), false, app.StartMetrics)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	a.Srv().LoadLicense()

	rctx := request.EmptyContext(a.Log())

	// Run jobs
	rctx.Logger().Info("Starting Mattermost job server")
	defer rctx.Logger().Info("Stopped Mattermost job server")

	if !noJobs {
		a.Srv().Jobs.StartWorkers()
		defer a.Srv().Jobs.StopWorkers()
	}
	if !noSchedule {
		a.Srv().Jobs.StartSchedulers()
		defer a.Srv().Jobs.StopSchedulers()
	}

	if !noJobs || !noSchedule {
		auditRec := a.MakeAuditRecord(rctx, "jobServer", audit.Success)
		a.LogAuditRec(rctx, auditRec, nil)
	}

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	// Cleanup anything that isn't handled by a defer statement
	rctx.Logger().Info("Stopping Mattermost job server")

	return nil
}
