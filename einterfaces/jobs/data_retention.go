// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

type DataRetentionInterface interface {
	MakeJob(store store.Store) model.Job
}

var theDataRetentionInterface DataRetentionInterface

func RegisterDataRetentionInterface(newInterface DataRetentionInterface) {
	theDataRetentionInterface = newInterface
}

func GetDataRetentionInterface() DataRetentionInterface {
	return theDataRetentionInterface
}
