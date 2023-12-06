// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build e2e
// +build e2e

package commands

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestMain(m *testing.M) {
	var options = testlib.HelperOptions{
		EnableStore:     true,
		EnableResources: true,
	}

	mainHelper := testlib.NewMainHelperWithOptions(&options)
	api4.SetMainHelper(mainHelper)
	defer mainHelper.Close()

	mainHelper.Main(m)
}
