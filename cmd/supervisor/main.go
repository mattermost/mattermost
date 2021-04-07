// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
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

	s := newSupervisor(config)
	go func() {
		if err := s.Start(); err != nil {
			fmt.Fprintf(os.Stderr, "Could not start the server: %v\n", err)
			os.Exit(1)
		}
	}()
	defer func() {
		if err := s.Stop(); err != nil {
			fmt.Fprintf(os.Stderr, "Error during stopping server: %v\n", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	<-sig
}
