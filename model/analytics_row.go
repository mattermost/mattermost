// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
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

func (ar AnalyticsRows) ToJson() string {
	b, err := json.Marshal(ar)
	if err != nil {
		return "[]"
	}
	return string(b)
}
