// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package model

type OmniSearchResult struct {
	Source      string `json:"source"`
	ID          string `json:"id"`
	Icon        string `json:"icon"`
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	Link        string `json:"link"`
	Description string `json:"description"`
	CreateAt    int64  `json:"create_at"`
	UpdateAt    int64  `json:"update_at"`
}
