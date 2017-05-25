// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	JOB_TYPE_DATA_RETENTION  = "data_retention"
	JOB_TYPE_SEARCH_INDEXING = "search_indexing"
)

type JobStatus struct {
	Id                 string                 `json:"id"`
	Type               string                 `json:"type"`
	StartAt            int64                  `json:"start_at"`
	LastActivityAt     int64                  `json:"last_activity_at"`
	LastRunStartedAt   int64                  `json:"last_run_started_at"`
	LastRunCompletedAt int64                  `json:"last_run_completed_at"`
	Status             string                 `json:"status"`
	Data               map[string]interface{} `json:"data"`
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

func JobStatusesToJson(statuses []*JobStatus) string {
	if b, err := json.Marshal(statuses); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func JobStatusesFromJson(data io.Reader) []*JobStatus {
	var statuses []*JobStatus
	if err := json.NewDecoder(data).Decode(&statuses); err == nil {
		return statuses
	} else {
		return nil
	}
}
