// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pluginapi

import "github.com/mattermost/mattermost/server/public/model"

// RegisterAutomationGroup registers a palette group for this plugin.
func (c *Client) RegisterAutomationGroup(group model.AutomationGroupDescriptor) error {
	return c.api.RegisterAutomationGroup(group)
}

// RegisterAutomationSignal registers a signal this plugin can emit.
func (c *Client) RegisterAutomationSignal(signal model.AutomationSignalDescriptor) error {
	return c.api.RegisterAutomationSignal(signal)
}

// RegisterAutomationAction registers an action Weave can run.
func (c *Client) RegisterAutomationAction(action model.AutomationActionDescriptor) error {
	return c.api.RegisterAutomationAction(action)
}

// EmitAutomationSignal emits a registered signal. traceToken is empty unless
// this call continues a chain the server already issued.
func (c *Client) EmitAutomationSignal(name string, payload map[string]model.AutomationValue, traceToken string) error {
	return c.api.EmitAutomationSignal(name, payload, traceToken)
}

// ExecuteAutomationAction calls the registered HTTP route for an action.
// Only a plugin that implements OnAutomationSignal may call it.
func (c *Client) ExecuteAutomationAction(req *model.AutomationActionRequest) (*model.AutomationActionResponse, error) {
	return c.api.ExecuteAutomationAction(req)
}

// ListAutomationContributions returns the registry. The server allows it only
// for a plugin that implements OnAutomationSignal.
func (c *Client) ListAutomationContributions() ([]model.AutomationGroupDescriptor, []model.AutomationSignalDescriptor, []model.AutomationActionDescriptor, error) {
	return c.api.ListAutomationContributions()
}
