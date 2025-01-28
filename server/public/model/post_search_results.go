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
	psCopy := *o
	psCopy.PostList.StripActionIntegrations()
	b, err := json.Marshal(&psCopy)
	return string(b), err
}

func (o *PostSearchResults) EncodeJSON(w io.Writer) error {
	o.PostList.StripActionIntegrations()
	return json.NewEncoder(w).Encode(o)
}

func (o *PostSearchResults) ForPlugin() *PostSearchResults {
	plCopy := *o
	plCopy.PostList = plCopy.PostList.ForPlugin()
	return &plCopy
}

func (o *PostSearchResults) Auditable() map[string]interface{} {
	var numResults int
	var hasNext bool

	if o.PostList != nil {
		numResults = len(o.PostList.Posts)
		hasNext = SafeDereference(o.PostList.HasNext)
	}

	return map[string]any{
		"num_results": numResults,
		"has_next":    hasNext,
	}
}
