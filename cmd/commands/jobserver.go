// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"os"
	"os/signal"
	"syscall"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/cmd"
	"github.com/spf13/cobra"
)

var JobserverCmd = &cobra.Command{
	Use:   "jobserver",
	Short: "Start the Mattermost job server",
	Run:   jobserverCmdF,
}

func init() {
	JobserverCmd.Flags().Bool("nojobs", false, "Do not run jobs on this jobserver.")
	JobserverCmd.Flags().Bool("noschedule", false, "Do not schedule jobs from this jobserver.")

	cmd.RootCmd.AddCommand(JobserverCmd)
}

func jobserverCmdF(command *cobra.Command, args []string) {
	// Options
	noJobs, _ := command.Flags().GetBool("nojobs")
	noSchedule, _ := command.Flags().GetBool("noschedule")

	// Initialize
	a, err := cmd.InitDBCommandContext("config.json")
	if err != nil {
		panic(err.Error())
	}
	defer l4g.Close()
	defer a.Shutdown()

	a.LoadLicense()

	// Run jobs
	l4g.Info("Starting Mattermost job server")
	if !noJobs {
		a.Jobs.StartWorkers()
	}
	if !noSchedule {
		a.Jobs.StartSchedulers()
	}

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	// Cleanup anything that isn't handled by a defer statement
	l4g.Info("Stopping Mattermost job server")

	a.Jobs.StopSchedulers()
	a.Jobs.StopWorkers()

	l4g.Info("Stopped Mattermost job server")
}
