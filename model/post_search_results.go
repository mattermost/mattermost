// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type PostSearchResults struct {
	*PostList
	Matches map[string][]string `json:"matches"`
}

func MakePostSearchResults(posts *PostList, matches map[string][]string) *PostSearchResults {
	return &PostSearchResults{
		posts,
		matches,
	}
}

func (o *PostSearchResults) ToJson() string {
	copy := *o
	copy.PostList.StripActionIntegrations()
	b, err := json.Marshal(&copy)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func PostSearchResultsFromJson(data io.Reader) *PostSearchResults {
	var o *PostSearchResults
	json.NewDecoder(data).Decode(&o)
	return o
}
