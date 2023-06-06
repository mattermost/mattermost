// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/mattermost/mattermost-server/server/public/model"
)

// generateDefaultConfig writes default config to outputFile.
func generateDefaultConfig(outputFile *os.File) error {
	defaultCfg := &model.Config{}
	defaultCfg.SetDefaults()
	if data, err := json.MarshalIndent(defaultCfg, "", "  "); err != nil {
		return err
	} else if _, err := outputFile.Write(data); err != nil {
		return err
	}
	return nil
}

func main() {
	outputFile := os.Getenv("OUTPUT_CONFIG")
	if outputFile == "" {
		fmt.Println("Output file name is missing. Please set OUTPUT_CONFIG env variable to absolute path")
		os.Exit(2)
	}
	if _, err := os.Stat(outputFile); !os.IsNotExist(err) {
		_, _ = fmt.Fprintf(os.Stderr, "File %s already exists. Not overwriting!\n", outputFile)
		os.Exit(2)
	}

	if file, err := os.Create(outputFile); err == nil {
		err = generateDefaultConfig(file)
		_ = file.Close()
		if err != nil {
			panic(err)
		}
	} else {
		panic(err)
	}
}
