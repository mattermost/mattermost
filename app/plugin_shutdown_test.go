// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"
)

func TestPluginShutdownTest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test to verify forced shutdown of slow plugin")
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
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
				"github.com/mattermost/mattermost-server/v5/plugin"
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
		}, th.App, th.App.NewPluginAPI)
	defer tearDown()

	done := make(chan bool)
	go func() {
		defer close(done)
		th.App.ShutDownPlugins()
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		t.Fatal("failed to force plugin shutdown after 10 seconds")
	}
}
