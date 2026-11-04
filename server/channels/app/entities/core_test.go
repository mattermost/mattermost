// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"context"
	"testing"

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
