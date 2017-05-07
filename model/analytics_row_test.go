// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestAnalyticsRowJson(t *testing.T) {
	a1 := AnalyticsRow{}
	a1.Name = "2015-10-12"
	a1.Value = 12345.0
	json := a1.ToJson()
	ra1 := AnalyticsRowFromJson(strings.NewReader(json))

	if a1.Name != ra1.Name {
		t.Fatal("days didn't match")
	}
}

func TestAnalyticsRowsJson(t *testing.T) {
	a1 := AnalyticsRow{}
	a1.Name = "2015-10-12"
	a1.Value = 12345.0

	var a1s AnalyticsRows = make([]*AnalyticsRow, 1)
	a1s[0] = &a1

	ljson := a1s.ToJson()
	results := AnalyticsRowsFromJson(strings.NewReader(ljson))

	if a1s[0].Name != results[0].Name {
		t.Fatal("Ids do not match")
	}
}
