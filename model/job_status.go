// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
)

const (
	JOB_TYPE_DATA_RETENTION  = "data_retention"
	JOB_TYPE_SEARCH_INDEXING = "search_indexing"
)

type JobStatus struct {
	Type               string                 `json:"type"`
	LastRunStartedAt   int64                  `json:"last_run_started_at"`
	LastRunCompletedAt int64                  `json:"last_run_completed_at"`
	LastHeartbeatAt    int64                  `json:"last_heartbeat_at"`
	Status             string                 `json:"status"`
	Progress           map[string]interface{} `json:"progress"`
}

func (js *JobStatus) ToJson() string {
	if b, err := json.Marshal(js); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func JobStatusFromJson(data io.Reader) *JobStatus {
	var status JobStatus
	if err := json.NewDecoder(data).Decode(&status); err == nil {
		return &status
	} else {
		return nil
	}
}
