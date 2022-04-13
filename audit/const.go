// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

const (
	DefMaxQueueSize = 1000

	KeyAPIPath   = "api_path"
	KeyEventName = "event_name"
	KeyEventData = "event_data"
	KeyObject    = "object"
	KeyOrigin    = "origin"
	KeyResult    = "result"
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
