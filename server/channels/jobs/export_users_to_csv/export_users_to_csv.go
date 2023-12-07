// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_users_to_csv

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const (
	timeBetweenBatches = 1 * time.Second
)

// MakeWorker creates a batch migration worker to delete empty drafts.
func MakeWorker(jobServer *jobs.JobServer, store store.Store, app jobs.BatchReportWorkerAppIFace) model.Worker {
	return jobs.MakeBatchReportWorker(
		jobServer,
		store,
		app,
		timeBetweenBatches,
		"csv",
		getData,
	)
}

// parseJobMetadata parses the opaque job metadata to return the information needed to decide which
// batch to process next.
func parseJobMetadata(data model.StringMap) (interface{}, error) {
	return struct {
		LastSortColumnValue string
		LastUserId          string
	}{
		LastSortColumnValue: data["last_column_value"],
		LastUserId:          data["last_user_id"],
	}, nil
}

// makeJobMetadata encodes the information needed to decide which batch to process next back into
// the opaque job metadata.
func makeJobMetadata(lastColumnValue string, userID string) model.StringMap {
	data := make(model.StringMap)
	data["last_column_value"] = lastColumnValue
	data["last_user_id"] = userID

	return data
}

func getData(jobData model.StringMap, app jobs.BatchReportWorkerAppIFace) ([]model.ReportableObject, model.StringMap, bool, error) {
	filter, err := parseJobMetadata(jobData)
	if err != nil {
		return nil, nil, false, errors.Wrap(err, "failed to parse job metadata")
	}

	users := []model.User{model.User{Id: "test"}}

	// Actually get the data

	return []model.ReportableObject{users}, makeJobMetadata("todo", "me"), false, nil
}
