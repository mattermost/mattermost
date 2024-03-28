// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugintest_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	goPlugin "github.com/hashicorp/go-plugin"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type UnitTestedPlugin struct {
	plugin.MattermostPlugin
}

// This example demonstrates a plugin that's launched during a unit test and reattached to an
// existing server instance to obtain a real PluginAPI.
func Example_unitTestingPlugins() {
	t := &testing.T{}

	// The manifest is usually generated dynamically.
	manifest := &model.Manifest{
		Id: "reattach-plugin-test",
	}

	// ctx, and specifically cancel, gives us control over the plugin lifecycle
	ctx, cancel := context.WithCancel(context.Background())

	// reattachConfigCh is the means by which we get the Unix socket information to relay back
	// to the server and finish the reattachment.
	reattachConfigCh := make(chan *goPlugin.ReattachConfig)

	// closeCh tells us when the plugin exits and allows for cleanup.
	closeCh := make(chan struct{})

	// plugin.ClientMain with options allows for reattachment.
	go plugin.ClientMain(
		&UnitTestedPlugin{},
		plugin.WithTestContext(ctx),
		plugin.WithTestReattachConfigCh(reattachConfigCh),
		plugin.WithTestCloseCh(closeCh),
	)

	// Make sure the plugin shuts down normally with the test
	t.Cleanup(func() {
		cancel()

		select {
		case <-closeCh:
		case <-time.After(5 * time.Second):
			panic("plugin failed to close after 5 seconds")
		}
	})

	// Wait for the plugin to start and then reattach to the server.
	var reattachConfig *goPlugin.ReattachConfig
	select {
	case reattachConfig = <-reattachConfigCh:
	case <-time.After(5 * time.Second):
		t.Fatal("failed to get reattach config")
	}

	// Reattaching requires a local mode client.
	socketPath := os.Getenv("MM_LOCALSOCKETPATH")
	if socketPath == "" {
		socketPath = model.LocalModeSocketPath
	}

	clientLocal := model.NewAPIv4SocketClient(socketPath)
	_, err := clientLocal.ReattachPlugin(ctx, &model.PluginReattachRequest{
		Manifest:             manifest,
		PluginReattachConfig: model.NewPluginReattachConfig(reattachConfig),
	})
	require.NoError(t, err)

	// At this point, the plugin is ready for unit testing and will be cleaned up automatically
	// with the testing.T instance.
}
