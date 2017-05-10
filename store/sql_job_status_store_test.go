// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestJobStatusSaveUpdateDelete(t *testing.T) {
	Setup()

	status := &model.JobStatus{
		Type:   model.NewId(),
		Status: model.NewId(),
		Progress: map[string]interface{}{
			"Processed":     0,
			"Total":         12345,
			"LastProcessed": "abcd",
		},
	}
	deleted := false
	defer func() {
		if !deleted {
			<-store.JobStatus().DeleteByType(status.Type)
		}
	}()

	if result := <-store.JobStatus().SaveOrUpdate(status); result.Err != nil {
		t.Fatal(result.Err)
	}

	status.Status = model.NewId()
	status.Progress = map[string]interface{}{
		"Processed":     12345,
		"Total":         12345,
		"LastProcessed": "abcd",
	}

	if result := <-store.JobStatus().SaveOrUpdate(status); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.JobStatus().DeleteByType(status.Type); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		deleted = true
	}
}
