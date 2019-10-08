// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"fmt"
	"os"
)

const pluginPackagePath = "github.com/mattermost/mattermost-server/plugin"

func main() {
	if err := checkAPIVersionComments(pluginPackagePath); err != nil {
		fmt.Fprintln(os.Stderr, "#", pluginPackagePath)
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
