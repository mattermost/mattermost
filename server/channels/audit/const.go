// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

const (
	DefMaxQueueSize = 1000

	KeyActor     = "actor"
	KeyAPIPath   = "api_path"
	KeyEvent     = "event"
	KeyEventData = "event_data"
	KeyEventName = "event_name"
	KeyMeta      = "meta"
	KeyError     = "error"
	KeyStatus    = "status"
	KeyUserID    = "user_id"
	KeySessionID = "session_id"
	KeyClient    = "client"
	KeyIPAddress = "ip_address"
	KeyClusterID = "cluster_id"

	Success = "success"
	Attempt = "attempt"
	Fail    = "fail"
)
