// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type FileInfoSearchMatches map[string][]string

type FileInfoSearchResults struct {
	*FileInfoList
	Matches FileInfoSearchMatches `json:"matches"`
}

func MakeFileInfoSearchResults(fileInfos *FileInfoList, matches FileInfoSearchMatches) *FileInfoSearchResults {
	return &FileInfoSearchResults{
		fileInfos,
		matches,
	}
}

func (o *FileInfoSearchResults) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	}
	return string(b)
}

func FileInfoSearchResultsFromJson(data io.Reader) *FileInfoSearchResults {
	var o *FileInfoSearchResults
	json.NewDecoder(data).Decode(&o)
	return o
}
