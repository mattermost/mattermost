// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"os"
	"os/signal"
	"syscall"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/job"
	// "github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func main() {
	// Initialize
	utils.InitAndLoadConfig("config.json")

	defer l4g.Close()

	s := store.NewSqlStore()

	jobs := job.InitJobs(s)

	// Run jobs
	var signalChan chan os.Signal = make(chan os.Signal)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	jobs.StartAll()

	<-signalChan

	// Cleanup anything that isn't handled by a defer statement
	l4g.Info("Stopping Mattermost job server")

	jobs.StopAll()
	s.Close()

	l4g.Info("Stopped Mattermost job server")
}
