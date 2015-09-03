// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"flag"
	"fmt"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/manualtesting"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/web"
	"os"
	"os/signal"
	"syscall"
)

func main() {

	pwd, _ := os.Getwd()
	fmt.Println("Current working directory is set to " + pwd)

	var config = flag.String("config", "config.json", "path to config file")
	var action = flag.String("action", "none", "path to config file")
	flag.Parse()

	fmt.Println(action)

	if len(action) > 0 {
		return
	}

	utils.LoadConfig(*config)
	api.NewServer()
	api.InitApi()
	web.InitWeb()
	api.StartServer()

	// If we allow testing then listen for manual testing URL hits
	if utils.Cfg.ServiceSettings.AllowTesting {
		manualtesting.InitManualTesting()
	}

	// wait for kill signal before attempting to gracefully shutdown
	// the running service
	c := make(chan os.Signal)
	signal.Notify(c, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	<-c

	api.StopServer()
}
