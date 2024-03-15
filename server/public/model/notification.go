// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	StatusBlocked     = "blocked"
	StatusServerError = "server_error"
	StatusNotSent     = "not_sent"

	TypeEmail     = "email"
	TypeWebsocket = "websocket"
	TypePush      = "push"

	ReasonServerConfig   = "server_config"
	ReasonUserConfig     = "user_config"
	ReasonUserStatus     = "user_status"
	ReasonFetchError     = "error_fetching"
	ReasonServerError    = "server_error"
	ReasonMissingProfile = "missing_profile"
	ReasonPushProxyError = "push_proxy_error"
)
