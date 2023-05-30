// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type SuggestCommand struct {
	Suggestion  string `json:"suggestion"`
	Description string `json:"description"`
}
