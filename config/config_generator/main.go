// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/mattermost/mattermost-server/model"
)

func usage() {
	_, _ = fmt.Fprintf(os.Stderr, "usage: config_generator [output_file]\n")
	os.Exit(2)
}

func main() {
	flag.Usage = usage
	flag.Parse()

	args := flag.Args()
	if len(args) < 1 {
		fmt.Println("Output file name is missing.")
		usage()
	}
	outputFile := args[0]
	if _, err := os.Stat(outputFile); !os.IsNotExist(err) {
		_, _ = fmt.Fprintf(os.Stderr, "File %s already exists. Not overwriting!\n", outputFile)
		usage()
	}

	defaultCfg := &model.Config{}
	defaultCfg.SetDefaults()
	if data, err := json.MarshalIndent(defaultCfg, "", "  "); err != nil {
		panic(err)
	} else if err := ioutil.WriteFile(outputFile, data, 0644); err != nil {
		panic(err)
	}

}
