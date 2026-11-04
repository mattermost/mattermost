// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCoreTimeIsDetectedAndDescribed(t *testing.T) {
	found, _ := Detect("shipped at 2024-06-01T15:04:05Z today")
	require.NotEmpty(t, found)
	var timeHit bool
	for _, entity := range found {
		for _, typeID := range entity.TypeIDs {
			if typeID == coreTimeTypeID {
				timeHit = true
				card, err := CoreLookup(context.Background(), typeID, entity.Value)
				require.NoError(t, err)
				require.NotNil(t, card)
				require.Equal(t, "Timestamp", card.Title)
				require.NotZero(t, card.Instant)
				require.NotEmpty(t, card.Blocks)
			}
		}
	}
	require.True(t, timeHit)
}

func TestCoreTimeRejectsDateOnly(t *testing.T) {
	found, _ := Detect("see ticket 2024-06-01 in the queue")
	for _, entity := range found {
		for _, typeID := range entity.TypeIDs {
			require.NotEqual(t, coreTimeTypeID, typeID)
		}
	}
}

func TestCoreTimeClockZoneFormats(t *testing.T) {
	cases := []struct {
		message string
		value   string
		hourUTC int
	}{
		{message: "meet at 16:30 CET please", value: "16:30 CET", hourUTC: 15},
		{message: "meet at 16.30 CET please", value: "16.30 CET", hourUTC: 15},
		{message: "meet at 4:30pm CET please", value: "4:30pm CET", hourUTC: 15},
		{message: "meet at 4.30pm CET please", value: "4.30pm CET", hourUTC: 15},
		{message: "meet at 4.30 p.m. CET please", value: "4.30 p.m. CET", hourUTC: 15},
		{message: "meet at 4pm CET please", value: "4pm CET", hourUTC: 15},
		{message: "call at 9:05 AM EST", value: "9:05 AM EST", hourUTC: 14},
		{message: "sync 14:00 UTC with the team", value: "14:00 UTC", hourUTC: 14},
	}
	for _, tc := range cases {
		t.Run(tc.value, func(t *testing.T) {
			found, _ := Detect(tc.message)
			var hit string
			for _, entity := range found {
				for _, typeID := range entity.TypeIDs {
					if typeID == coreTimeTypeID {
						hit = entity.Value
					}
				}
			}
			require.Equal(t, tc.value, hit)
			card, err := CoreLookup(context.Background(), coreTimeTypeID, hit)
			require.NoError(t, err)
			instant := time.UnixMilli(card.Instant).UTC()
			require.Equal(t, tc.hourUTC, instant.Hour())
		})
	}
}

func TestCoreTimeRejectsBareClock(t *testing.T) {
	found, _ := Detect("see you at 16:30 in the lobby")
	for _, entity := range found {
		for _, typeID := range entity.TypeIDs {
			require.NotEqual(t, coreTimeTypeID, typeID)
		}
	}
}
