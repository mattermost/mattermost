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

func (o *PostSearchResults) ToJSON() (string, error) {
	copy := *o
	copy.PostList.StripActionIntegrations()
	b, err := json.Marshal(&copy)
	return string(b), err
}

func (o *PostSearchResults) EncodeJSON(w io.Writer) error {
	o.PostList.StripActionIntegrations()
	return json.NewEncoder(w).Encode(o)
}

func (o *PostSearchResults) ForPlugin() *PostSearchResults {
	copy := *o
	copy.PostList = copy.PostList.ForPlugin()
	return &copy
}
