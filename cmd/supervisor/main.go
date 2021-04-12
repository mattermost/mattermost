// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
)

func main() {
	var configFile string
	flag.StringVar(&configFile, "config", "config/supervisor.json", "Configuration file for Supervisor.")
	flag.Parse()

	config, err := parseConfig(configFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Could not parse config file: %v\n", err)
		os.Exit(1)
	}

	sup, err := newSupervisor(config)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Could not initialize supervisor: %v\n", err)
		os.Exit(1)
	}

	if err = sup.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "Could not start apps: %v\n", err)
		os.Exit(1)
	}
	// start server
	sup.logger.Println("Starting supervisor proxy...")
	http.HandleFunc("/", sup.handleRequestAndRedirect)
	if err := http.ListenAndServe(config.ServiceSettings.Host, nil); err != nil {
		fmt.Fprintf(os.Stderr, "Could not start the server: %v\n", err)
		os.Exit(1)
	}

	defer func() {
		if err := sup.Stop(); err != nil {
			fmt.Fprintf(os.Stderr, "Error during stopping server: %v\n", err)
		}
	}()
}
