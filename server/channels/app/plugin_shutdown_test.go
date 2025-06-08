// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestPluginShutdownTest(t *testing.T) {
	mainHelper.Parallel(t)
	if testing.Short() {
		t.Skip("skipping test to verify forced shutdown of slow plugin")
	}

	th := Setup(t)
	defer th.TearDown()

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnDeactivate() error {
				c := make(chan bool)
				<-c

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()

	done := make(chan bool)
	go func() {
		defer close(done)
		th.App.ch.ShutDownPlugins()
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		require.Fail(t, "failed to force plugin shutdown after 10 seconds")
	}
}
