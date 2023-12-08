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

type ExportUsersToCSVAppIFace interface {
	jobs.BatchReportWorkerAppIFace
	GetUsersForReporting(filter *model.UserReportOptions) ([]*model.UserReport, *model.AppError)
}

// MakeWorker creates a batch migration worker to delete empty drafts.
func MakeWorker(jobServer *jobs.JobServer, store store.Store, app ExportUsersToCSVAppIFace) model.Worker {
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
func parseJobMetadata(data model.StringMap) (*model.UserReportOptions, error) {
	options := model.UserReportOptionsAPI{
		UserReportOptionsWithoutDateRange: model.UserReportOptionsWithoutDateRange{
			SortColumn:          "Username",
			PageSize:            100,
			LastSortColumnValue: data["last_column_value"],
			LastUserId:          data["last_user_id"],
		},
		DateRange: data["date_range"],
	}

	return options.ToBaseOptions(time.Now()), nil
}

// makeJobMetadata encodes the information needed to decide which batch to process next back into
// the opaque job metadata.
func makeJobMetadata(lastColumnValue string, userID string) model.StringMap {
	data := make(model.StringMap)
	data["last_column_value"] = lastColumnValue
	data["last_user_id"] = userID

	return data
}

func getData(jobData model.StringMap, app ExportUsersToCSVAppIFace) ([]model.ReportableObject, model.StringMap, bool, error) {
	filter, err := parseJobMetadata(jobData)
	if err != nil {
		return nil, nil, false, errors.Wrap(err, "failed to parse job metadata")
	}

	users, appErr := app.GetUsersForReporting(filter)
	if appErr != nil {
		return nil, nil, false, errors.Wrapf(err, "failed to get the next batch (column_value=%v, user_id=%v)", filter.LastSortColumnValue, filter.LastUserId)
	}

	if len(users) == 0 {
		return nil, nil, true, nil
	}

	reportableObjects := []model.ReportableObject{}
	for i := 0; i < len(users); i++ {
		reportableObjects = append(reportableObjects, users[i])
	}

	return reportableObjects, makeJobMetadata(users[len(users)-1].Username, users[len(users)-1].Id), false, nil
}
