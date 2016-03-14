// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type ComplianceInterface interface {
	StartComplianceDailyJob()
	RunComplianceJob(jobName string, dir string, filename string, startTime int64, endTime int64) *model.AppError
}

var theComplianceInterface ComplianceInterface

func RegisterComplianceInterface(newInterface ComplianceInterface) {
	theComplianceInterface = newInterface
}

func GetComplianceInterface() ComplianceInterface {
	return theComplianceInterface
}
