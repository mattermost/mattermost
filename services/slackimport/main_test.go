// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slackimport

import (
	"fmt"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	prevDir, err := os.Getwd()
	if err != nil {
		panic("Failed to get current working directory: " + err.Error())
	}

	err = os.Chdir("../..")
	if err != nil {
		panic(fmt.Sprintf("Failed to set current working directory to %s: %s", "../..", err.Error()))
	}

	defer func() {
		err := os.Chdir(prevDir)
		if err != nil {
			panic(fmt.Sprintf("Failed to restore current working directory to %s: %s", prevDir, err.Error()))
		}
	}()

	os.Exit(m.Run())
}
