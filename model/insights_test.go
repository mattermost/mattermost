// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetTimeRange(t *testing.T) {
	tc := [3]string{"1_day", "7_day", "28_day"}

	for _, timeRange := range tc {
		t.Run(timeRange, func(t *testing.T) {
			_, err := GetTimeRange(timeRange)
			assert.Nil(t, err)
		})
	}

	invalidTimeRanges := [3]string{"", "1_days", "10_day"}

	for _, timeRange := range invalidTimeRanges {
		t.Run(timeRange, func(t *testing.T) {
			_, err := GetTimeRange(timeRange)
			assert.NotNil(t, err)
		})
	}
}
