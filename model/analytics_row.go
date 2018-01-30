// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

func (me *AnalyticsRow) ToJson() string {
	b, _ := json.Marshal(me)
	return string(b)
}

func AnalyticsRowFromJson(data io.Reader) *AnalyticsRow {
	var me *AnalyticsRow
	json.NewDecoder(data).Decode(&me)
	return me
}

func (me AnalyticsRows) ToJson() string {
	if b, err := json.Marshal(me); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func AnalyticsRowsFromJson(data io.Reader) AnalyticsRows {
	var me AnalyticsRows
	json.NewDecoder(data).Decode(&me)
	return me
}
