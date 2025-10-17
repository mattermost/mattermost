// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

// Context passes through metadata about the request or hook event.
// For requests this is built in app/plugin_requests.go
// For hooks, app.PluginContext() is called.
type Context struct {
	SessionId      string
	RequestId      string
	IPAddress      string
	AcceptLanguage string
	UserAgent      string
	// SourcePluginId is the ID of the plugin making a bridge call.
	// Empty string indicates the call originated from core Mattermost server.
	// This field is only populated for ExecuteBridgeCall hook invocations.
	//
	// Minimum server version: 11.1
	SourcePluginId string
}
