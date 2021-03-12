// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

var a1 = AnalyticsRow{
	Name:  "2015-10-12",
	Value: 12345.0,
}

func TestAnalyticsRowJson(t *testing.T) {
	ra1 := AnalyticsRowFromJson(strings.NewReader(a1.ToJson()))
	require.Equal(t, a1.Name, ra1.Name, "days didn't match")
}

func TestAnalyticsRowsJson(t *testing.T) {
	var a1s AnalyticsRows = make([]*AnalyticsRow, 1)
	a1s[0] = &a1
	results := AnalyticsRowsFromJson(strings.NewReader(a1s.ToJson()))
	require.Equal(t, a1s[0].Name, results[0].Name, "Ids do not match")
}
