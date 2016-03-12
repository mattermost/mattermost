// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import ()

type ComplianceInterface interface {
	StartComplianceDailyJob()
}

var theComplianceInterface ComplianceInterface

func RegisterComplianceInterface(newInterface ComplianceInterface) {
	theComplianceInterface = newInterface
}

func GetComplianceInterface() ComplianceInterface {
	return theComplianceInterface
}
