// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

const (
	MaxQueueSize = 1000

	RestLevelID        = 240
	RestContentLevelID = 241
	CLILevelID         = 242
	AppLevelID         = 243
	ModelLevelID       = 244

	KeyID        = "id"
	KeyAPIPath   = "api_path"
	KeyEvent     = "event"
	KeyStatus    = "status"
	KeyUserID    = "user_id"
	KeySessionID = "session_id"
	KeyClient    = "client"
	KeyIPAddress = "ip_address"

	Success = "success"
	Attempt = "attempt"
	Fail    = "fail"
)
