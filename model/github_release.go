// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type GithubReleaseInfo struct {
	Id          int    `json:"id"`
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	CreatedAt   string `json:"created_at"`
	PublishedAt string `json:"published_at"`
	Body        string `json:"body"`
	Url         string `json:"html_url"`
}
