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

type ElasticsearchAggregatorInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() model.Scheduler
}

var theElasticsearchAggregatorInterface ElasticsearchAggregatorInterface

func RegisterElasticsearchAggregatorInterface(newInterface ElasticsearchAggregatorInterface) {
	theElasticsearchAggregatorInterface = newInterface
}

func GetElasticsearchAggregatorInterface() ElasticsearchAggregatorInterface {
	return theElasticsearchAggregatorInterface
}
