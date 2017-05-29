// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
)

func GetJobStatus(id string) (*model.JobStatus, *model.AppError) {
	if result := <-Srv.Store.JobStatus().Get(id); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.JobStatus), nil
	}
}

func GetJobStatusesByTypePage(jobType string, page int, perPage int) ([]*model.JobStatus, *model.AppError) {
	return GetJobStatusesByType(jobType, page*perPage, perPage)
}

func GetJobStatusesByType(jobType string, offset int, limit int) ([]*model.JobStatus, *model.AppError) {
	if result := <-Srv.Store.JobStatus().GetAllByTypePage(jobType, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.JobStatus), nil
	}
}
