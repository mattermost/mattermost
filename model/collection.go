// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type CollectionMetadata struct {
	Id             string `json:"id"`
	CollectionType string `json:"collection_type"`
	TeamId         string `json:"team_id"`
	Name           string `json:"name"`
	RelativeURL    string `json:"relative_url"`
}

type TopicMetadata struct {
	Id             string `json:"id"`
	TopicType      string `json:"topic_type"`
	CollectionType string `json:"collection_type"`
	TeamId         string `json:"team_id"`
	CollectionId   string `json:"collection_id"`
}
