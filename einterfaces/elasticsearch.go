// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import "github.com/mattermost/platform/model"

type ElasticSearchInterface interface {
	Start() *model.AppError
	IndexPost(post *model.Post, teamId string)
	SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams) ([]string, *model.AppError)
	DeletePost(postId string)
}

var theElasticSearchInterface ElasticSearchInterface

func RegisterElasticSearchInterface(newInterface ElasticSearchInterface) {
	theElasticSearchInterface = newInterface
}

func GetElasticSearchInterface() ElasticSearchInterface {
	return theElasticSearchInterface
}
