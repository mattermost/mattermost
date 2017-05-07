// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func GetComplianceReports(page, perPage int) (model.Compliances, *model.AppError) {
	if !*utils.Cfg.ComplianceSettings.Enable || !utils.IsLicensed || !*utils.License.Features.Compliance {
		return nil, model.NewLocAppError("GetComplianceReports", "ent.compliance.licence_disable.app_error", nil, "")
	}

	if result := <-Srv.Store.Compliance().GetAll(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(model.Compliances), nil
	}
}

func SaveComplianceReport(job *model.Compliance) (*model.Compliance, *model.AppError) {
	if !*utils.Cfg.ComplianceSettings.Enable || !utils.IsLicensed || !*utils.License.Features.Compliance || einterfaces.GetComplianceInterface() == nil {
		return nil, model.NewLocAppError("saveComplianceReport", "ent.compliance.licence_disable.app_error", nil, "")
	}

	job.Type = model.COMPLIANCE_TYPE_ADHOC

	if result := <-Srv.Store.Compliance().Save(job); result.Err != nil {
		return nil, result.Err
	} else {
		job = result.Data.(*model.Compliance)
		go einterfaces.GetComplianceInterface().RunComplianceJob(job)
	}

	return job, nil
}

func GetComplianceReport(reportId string) (*model.Compliance, *model.AppError) {
	if !*utils.Cfg.ComplianceSettings.Enable || !utils.IsLicensed || !*utils.License.Features.Compliance || einterfaces.GetComplianceInterface() == nil {
		return nil, model.NewLocAppError("downloadComplianceReport", "ent.compliance.licence_disable.app_error", nil, "")
	}

	if result := <-Srv.Store.Compliance().Get(reportId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Compliance), nil
	}
}

func GetComplianceFile(job *model.Compliance) ([]byte, *model.AppError) {
	if f, err := ioutil.ReadFile(*utils.Cfg.ComplianceSettings.Directory + "compliance/" + job.JobName() + ".zip"); err != nil {
		return nil, model.NewLocAppError("readFile", "api.file.read_file.reading_local.app_error", nil, err.Error())

	} else {
		return f, nil
	}
}
