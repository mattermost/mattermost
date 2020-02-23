// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

const (
	MaxQueueSize = 1000

	RestLevelID        = 240
	RestContentLevelID = 241
	RestPermsLevelID   = 242
	CLILevelID         = 243
	AppLevelID         = 244
	ModelLevelID       = 245

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
