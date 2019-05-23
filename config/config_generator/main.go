// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/mattermost/mattermost-server/config/config_generator/generator"
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

	if file, err := os.Create(outputFile); err == nil {
		err = generator.GenerateDefaultConfig(file)
		_ = file.Close()
		if err != nil {
			panic(err)
		}
	} else {
		panic(err)
	}

}
