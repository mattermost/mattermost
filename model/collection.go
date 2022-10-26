// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type CollectionMetadata struct {
	Id             string `json:"id"`
	TeamId         string `json:"team_id"`
	CollectionType string `json:"collection_type"`
	Name           string `json:"name"`
	RelativeURL    string `json:"relative_url"`
}

type TopicMetadata struct {
	Id             string `json:"id"`
	TeamId         string `json:"team_id"`
	TopicType      string `json:"topic_type"`
	CollectionType string `json:"collection_type"`
	CollectionId   string `json:"collection_id"`
}
