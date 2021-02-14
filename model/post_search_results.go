// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type PostSearchMatches map[string][]string

type PostSearchResults struct {
	*PostList
	Matches PostSearchMatches `json:"matches"`
}

func MakePostSearchResults(posts *PostList, matches PostSearchMatches) *PostSearchResults {
	return &PostSearchResults{
		posts,
		matches,
	}
}

func (o *PostSearchResults) ToJson() string {
	cp := *o
	cp.PostList.StripActionIntegrations()
	b, err := json.Marshal(&cp)
	if err != nil {
		return ""
	}
	return string(b)
}

func PostSearchResultsFromJson(data io.Reader) *PostSearchResults {
	var o *PostSearchResults
	json.NewDecoder(data).Decode(&o)
	return o
}
