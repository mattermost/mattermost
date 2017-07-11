// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"github.com/mattermost/platform/model"
)

type ElasticsearchIndexerInterface interface {
	MakeWorker() model.Worker
}

var theElasticsearchIndexerInterface ElasticsearchIndexerInterface

func RegisterElasticsearchIndexerInterface(newInterface ElasticsearchIndexerInterface) {
	theElasticsearchIndexerInterface = newInterface
}

func GetElasticsearchIndexerInterface() ElasticsearchIndexerInterface {
	return theElasticsearchIndexerInterface
}
