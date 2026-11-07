// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package loadtest

import (
	"fmt"

	"github.com/blang/semver"
	ltcontrol "github.com/mattermost/mattermost-load-test-ng/loadtest/control"
	ltplugins "github.com/mattermost/mattermost-load-test-ng/loadtest/plugins"
	ltuser "github.com/mattermost/mattermost-load-test-ng/loadtest/user"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

// SimulController is a load-test controller for the Playbooks plugin, to be
// injected in the load-test tool's SimulController tests.
// It implements the [ltplugins.Controller] interface
type SimulController struct {
	store *PluginStore
}

// Make sure that SimulController implements ltplugins.GenController
var _ ltplugins.SimulController = &SimulController{}

// PluginId returns the ID of the Playbooks plugin.
//
//nolint:staticcheck
func (c *SimulController) PluginId() string {
	return "playbooks"
}

// MinServerVersion returns the minimum version the Mattermost server must have
// to be able to run the registered actions.
func (c *SimulController) MinServerVersion() semver.Version {
	return semver.MustParse("11.0.0")
}

// wrapAction is a wrapper to translate between (User -> UserActionResponse)
// functions and ((User, Client) -> UserActionResponse) functions
// It is used to initialize the Playbooks client with the provided user's client,
// so that the current authorization and permissions are synced.
func wrapAction(action func(u ltuser.User, pbClient *client.Client) ltcontrol.UserActionResponse) func(u ltuser.User) ltcontrol.UserActionResponse {
	return func(u ltuser.User) ltcontrol.UserActionResponse {
		pbClient, err := client.New(u.Client())
		if err != nil {
			return ltcontrol.UserActionResponse{Err: fmt.Errorf("error creating playbooks client: %w", err)}
		}

		return action(u, pbClient)
	}

}

// Actions returns a list of all the registered actions implemented by Playbooks.
func (c *SimulController) Actions() []ltplugins.PluginAction {
	return []ltplugins.PluginAction{
		{
			Name:      "OpenRHS",
			Run:       wrapAction(c.OpenRHS),
			Frequency: 1.0,
		},
	}
}

// ClearUserData resets the underlying store to clear all previously stored data.
func (c *SimulController) ClearUserData() {
	c.store.Clear()
}

// RunHook is the entry point for running all hooks: it is in charge of
// converting the payload into the corresponding struct for each hook type, and
// running it.
func (c *SimulController) RunHook(hookType ltplugins.HookType, u ltuser.User, payload any) error {
	switch hookType {
	case ltplugins.HookLogin:
		// There is no payload expected for this hook
		return c.HookLogin(u)
	case ltplugins.HookSwitchTeam:
		p, ok := payload.(ltplugins.HookPayloadSwitchTeam)
		if !ok {
			return fmt.Errorf("unable to decode payload %v into HookPayloadSwitchTeam struct", payload)
		}
		return c.HookSwitchTeam(u, p.TeamId)
	case ltplugins.HookSwitchChannel:
		p, ok := payload.(ltplugins.HookPayloadSwitchChannel)
		if !ok {
			return fmt.Errorf("unable to decode payload %v into HookPayloadSwitchChannel struct", payload)
		}
		return c.HookSwitchChannel(u, p.ChannelId)
	default:
		// Any other hook is not implemented, so running this should be a no-op
		return nil
	}
}
