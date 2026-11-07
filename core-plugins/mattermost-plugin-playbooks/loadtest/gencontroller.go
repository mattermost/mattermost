// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import (
	"github.com/blang/semver"
	ltplugins "github.com/mattermost/mattermost-load-test-ng/loadtest/plugins"
)

// GenController is a load-test controller for the Playbooks plugin, to be
// injected in the load-test tool's GenController tests.
// It implements the [ltplugins.Plugin] interface
type GenController struct {
	store *PluginStore
}

// Make sure that GenController implements ltplugins.GenController
var _ ltplugins.GenController = &GenController{}

// PluginId returns the ID of the Playbooks plugin.
//
//nolint:staticcheck
func (c *GenController) PluginId() string {
	return "playbooks"
}

// MinServerVersion returns the minimum version the Mattermost server must have
// to be able to run the registered actions.
func (c *GenController) MinServerVersion() semver.Version {
	return semver.MustParse("11.0.0")
}

// Actions returns a list of allControlleregistered actions implemented by Playbooks.
func (c *GenController) Actions() []ltplugins.PluginAction {
	return []ltplugins.PluginAction{
		{
			Name:      "CreatePlaybook",
			Run:       wrapAction(c.CreatePlaybook),
			Frequency: 1.0,
		},
		{
			Name:      "CreateRun",
			Run:       wrapAction(c.CreateRun),
			Frequency: 1.0,
		},
	}
}

// ClearUserData resets the underlying store to clear all previously stored data.
func (c *GenController) ClearUserData() {
	c.store.Clear()
}

func (c *GenController) Done() bool {
	return globalState.done()
}
