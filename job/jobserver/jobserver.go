// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"os"
	"os/signal"
	"syscall"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/job"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"

	_ "github.com/mattermost/platform/imports"
)

var Srv job.JobServer

func main() {
	// Initialize
	utils.InitAndLoadConfig("config.json")
	defer l4g.Close()

	Srv.Store = store.NewSqlStore()
	defer Srv.Store.Close()

	Srv.LoadLicense()

	// Run jobs
	l4g.Info("Starting Mattermost job server")
	Srv.Jobs = job.InitJobs(Srv.Store)
	Srv.Jobs.StartAll()

	var signalChan chan os.Signal = make(chan os.Signal)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-signalChan

	// Cleanup anything that isn't handled by a defer statement
	l4g.Info("Stopping Mattermost job server")

	Srv.Jobs.StopAll()

	l4g.Info("Stopped Mattermost job server")
}
