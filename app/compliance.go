// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"

	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (a *App) GetComplianceReports(page, perPage int) (model.Compliances, *model.AppError) {
	if license := a.License(); !*a.Config().ComplianceSettings.Enable || license == nil || !*license.Features.Compliance {
		return nil, model.NewAppError("GetComplianceReports", "ent.compliance.licence_disable.app_error", nil, "", http.StatusNotImplemented)
	}

	result := <-a.Srv.Store.Compliance().GetAll(page*perPage, perPage)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(model.Compliances), nil
}

func (a *App) SaveComplianceReport(job *model.Compliance) (*model.Compliance, *model.AppError) {
	if license := a.License(); !*a.Config().ComplianceSettings.Enable || license == nil || !*license.Features.Compliance || a.Compliance == nil {
		return nil, model.NewAppError("saveComplianceReport", "ent.compliance.licence_disable.app_error", nil, "", http.StatusNotImplemented)
	}

	job.Type = model.COMPLIANCE_TYPE_ADHOC

	result := <-a.Srv.Store.Compliance().Save(job)
	if result.Err != nil {
		return nil, result.Err
	}

	job = result.Data.(*model.Compliance)
	a.Go(func() {
		a.Compliance.RunComplianceJob(job)
	})

	return job, nil
}

func (a *App) GetComplianceReport(reportId string) (*model.Compliance, *model.AppError) {
	if license := a.License(); !*a.Config().ComplianceSettings.Enable || license == nil || !*license.Features.Compliance || a.Compliance == nil {
		return nil, model.NewAppError("downloadComplianceReport", "ent.compliance.licence_disable.app_error", nil, "", http.StatusNotImplemented)
	}

	result := <-a.Srv.Store.Compliance().Get(reportId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.Compliance), nil
}

func (a *App) GetComplianceFile(job *model.Compliance) ([]byte, *model.AppError) {
	f, err := ioutil.ReadFile(*a.Config().ComplianceSettings.Directory + "compliance/" + job.JobName() + ".zip")
	if err != nil {
		return nil, model.NewAppError("readFile", "api.file.read_file.reading_local.app_error", nil, err.Error(), http.StatusNotImplemented)
	}
	return f, nil
}
