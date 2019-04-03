// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"github.com/mattermost/mattermost-server/config"
	"io/ioutil"
	"os"
)

func usage() {
	fmt.Fprintf(os.Stderr, "usage: config_generator [output_file]\n")
	flag.PrintDefaults()
	os.Exit(2)
}

func main() {
	flag.Usage = usage
	flag.Parse()

	args := flag.Args()
	if len(args) < 1 {
		fmt.Println("Input file is missing.")
		os.Exit(1)
	}

	configStore, err := config.NewFileStore("config.json", true)
	if err != nil {
		panic(err)
	}
	configFile := configStore.Get()
	if data, err := json.MarshalIndent(configFile, "", "  "); err != nil {
		panic(err)
	} else {
		configStore.Close()
		ioutil.WriteFile(args[0], data, 0644)
	}
}
