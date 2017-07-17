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

	JOB_STATUS_PENDING          = "pending"
	JOB_STATUS_IN_PROGRESS      = "in_progress"
	JOB_STATUS_SUCCESS          = "success"
	JOB_STATUS_ERROR            = "error"
	JOB_STATUS_CANCEL_REQUESTED = "cancel_requested"
	JOB_STATUS_CANCELED         = "canceled"
)

type Job struct {
	Id             string                 `json:"id"`
	Type           string                 `json:"type"`
	Priority       int64                  `json:"priority"`
	CreateAt       int64                  `json:"create_at"`
	StartAt        int64                  `json:"start_at"`
	LastActivityAt int64                  `json:"last_activity_at"`
	Status         string                 `json:"status"`
	Progress       int64                  `json:"progress"`
	Data           map[string]interface{} `json:"data"`
}

func (js *Job) ToJson() string {
	if b, err := json.Marshal(js); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func JobFromJson(data io.Reader) *Job {
	var status Job
	if err := json.NewDecoder(data).Decode(&status); err == nil {
		return &status
	} else {
		return nil
	}
}

func JobsToJson(jobs []*Job) string {
	if b, err := json.Marshal(jobs); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func JobsFromJson(data io.Reader) []*Job {
	var jobs []*Job
	if err := json.NewDecoder(data).Decode(&jobs); err == nil {
		return jobs
	} else {
		return nil
	}
}

func (js *Job) DataToJson() string {
	if b, err := json.Marshal(js.Data); err != nil {
		return ""
	} else {
		return string(b)
	}
}

type Worker interface {
	Run()
	Stop()
	JobChannel() chan<- Job
}

type Scheduler interface {
	Run()
	Stop()
}
