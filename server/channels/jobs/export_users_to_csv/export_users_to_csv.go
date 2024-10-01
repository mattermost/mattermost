// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_users_to_csv

import (
	"fmt"
	"strconv"
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

// MakeWorker creates a batch report worker to generate CSV user reports.
func MakeWorker(jobServer *jobs.JobServer, store store.Store, app ExportUsersToCSVAppIFace) model.Worker {
	return jobs.MakeBatchReportWorker(
		jobServer,
		store,
		app,
		timeBetweenBatches,
		"csv",
		[]string{
			"Id",
			"Username",
			"Email",
			"CreateAt",
			"Name",
			"Roles",
			"LastLogin",
			"LastStatusAt",
			"LastPostDate",
			"DaysActive",
			"TotalPosts",
			"DeletedAt",
		},
		getData(app),
	)
}

// parseJobMetadata parses the opaque job metadata to return the information needed to decide which
// batch to process next.
func parseJobMetadata(data model.StringMap) (*model.UserReportOptions, error) {
	startAt, err := strconv.ParseInt(data["start_at"], 10, 64)
	if err != nil {
		return nil, err
	}
	endAt, err := strconv.ParseInt(data["end_at"], 10, 64)
	if err != nil {
		return nil, err
	}

	hideInactive := false
	if val, ok := data["hide_inactive"]; ok && val != "" {
		hideInactive, err = strconv.ParseBool(val)
		if err != nil {
			return nil, fmt.Errorf("failed to parse hide_inactive: %w", err)
		}
	}

	hideActive := false
	if val, ok := data["hide_active"]; ok && val != "" {
		hideActive, err = strconv.ParseBool(val)
		if err != nil {
			return nil, fmt.Errorf("failed to parse hide_active: %w", err)
		}
	}

	options := model.UserReportOptions{
		ReportingBaseOptions: model.ReportingBaseOptions{
			SortColumn:      "Username",
			PageSize:        100,
			FromColumnValue: data["last_column_value"],
			FromId:          data["last_user_id"],
			StartAt:         startAt,
			EndAt:           endAt,
		},
		HideInactive: hideInactive,
		HideActive:   hideActive,
		Role:         data["role"],
		Team:         data["team"],
	}

	return &options, nil
}

// makeJobMetadata encodes the information needed to decide which batch to process next back into
// the opaque job metadata.
func makeJobMetadata(jobData model.StringMap, lastColumnValue string, userID string) model.StringMap {
	jobData["last_column_value"] = lastColumnValue
	jobData["last_user_id"] = userID
	return jobData
}

func getData(app ExportUsersToCSVAppIFace) func(jobData model.StringMap) ([]model.ReportableObject, model.StringMap, bool, error) {
	return func(jobData model.StringMap) ([]model.ReportableObject, model.StringMap, bool, error) {
		filter, err := parseJobMetadata(jobData)
		if err != nil {
			return nil, nil, false, errors.Wrap(err, "failed to parse job metadata")
		}

		users, appErr := app.GetUsersForReporting(filter)
		if appErr != nil {
			return nil, nil, false, errors.Wrapf(err, "failed to get the next batch (column_value=%v, user_id=%v)", filter.FromColumnValue, filter.FromId)
		}

		if len(users) == 0 {
			return nil, nil, true, nil
		}

		reportableObjects := []model.ReportableObject{}
		for i := 0; i < len(users); i++ {
			reportableObjects = append(reportableObjects, users[i])
		}

		return reportableObjects, makeJobMetadata(jobData, users[len(users)-1].Username, users[len(users)-1].Id), false, nil
	}
}
