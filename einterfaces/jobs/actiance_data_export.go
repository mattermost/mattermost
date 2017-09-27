// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"github.com/mattermost/mattermost-server/model"
)

type ActianceDataExportInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() model.Scheduler
}

var theActianceDataExportInterface ActianceDataExportInterface

func RegisterActianceDataExportInterface(newInterface ActianceDataExportInterface) {
	theActianceDataExportInterface = newInterface
}

func GetActianceDataExportInterface() ActianceDataExportInterface {
	return theActianceDataExportInterface
}
