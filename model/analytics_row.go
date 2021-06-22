// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type AnalyticsRow struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
}

type AnalyticsRows []*AnalyticsRow

func (ar *AnalyticsRow) ToJson() string {
	b, _ := json.Marshal(ar)
	return string(b)
}

func AnalyticsRowFromJson(data io.Reader) *AnalyticsRow {
	var ar *AnalyticsRow
	json.NewDecoder(data).Decode(&ar)
	return ar
}

func (ar AnalyticsRows) ToJson() string {
	b, err := json.Marshal(ar)
	if err != nil {
		return "[]"
	}
	return string(b)
}

func AnalyticsRowsFromJson(data io.Reader) AnalyticsRows {
	var ar AnalyticsRows
	json.NewDecoder(data).Decode(&ar)
	return ar
}
