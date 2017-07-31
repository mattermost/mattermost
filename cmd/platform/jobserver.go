// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"os"
	"os/signal"
	"syscall"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/jobs"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/spf13/cobra"
)

var jobserverCmd = &cobra.Command{
	Use:   "jobserver",
	Short: "Start the Mattermost job server",
	Run:   jobserverCmdF,
}

func init() {
	jobserverCmd.Flags().Bool("nojobs", false, "Do not run jobs on this jobserver.")
	jobserverCmd.Flags().Bool("noschedule", false, "Do not schedule jobs from this jobserver.")
}

func jobserverCmdF(cmd *cobra.Command, args []string) {
	// Options
	noJobs, _ := cmd.Flags().GetBool("nojobs")
	noSchedule, _ := cmd.Flags().GetBool("noschedule")

	// Initialize
	utils.InitAndLoadConfig("config.json")
	defer l4g.Close()

	jobs.Srv.Store = store.NewLayeredStore()
	defer jobs.Srv.Store.Close()

	jobs.Srv.LoadLicense()

	// Run jobs
	l4g.Info("Starting Mattermost job server")
	if !noJobs {
		jobs.Srv.StartWorkers()
	}
	if !noSchedule {
		jobs.Srv.StartSchedulers()
	}

	var signalChan chan os.Signal = make(chan os.Signal)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	// Cleanup anything that isn't handled by a defer statement
	l4g.Info("Stopping Mattermost job server")

	jobs.Srv.StopSchedulers()
	jobs.Srv.StopWorkers()

	l4g.Info("Stopped Mattermost job server")
}
