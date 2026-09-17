// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAllHealthAreasCovered(t *testing.T) {
	inAll := make(map[HealthArea]struct{}, len(AllHealthAreas()))
	for _, area := range AllHealthAreas() {
		inAll[area] = struct{}{}
	}

	declared := []HealthArea{
		AreaAuth, AreaDatabase, AreaSearch, AreaJobs, AreaCluster,
		AreaNotifications, AreaCompliance, AreaPlatform, AreaLicense, AreaVersion,
	}
	for _, area := range declared {
		require.Contains(t, inAll, area, "constant %q missing from AllHealthAreas", area)
	}
	require.Len(t, AllHealthAreas(), len(declared), "update this test and AllHealthAreas when adding a HealthArea")
}
