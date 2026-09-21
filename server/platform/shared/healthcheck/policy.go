// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "time"

type Policy struct {
	FireAfter  int
	ClearAfter int
	ClearRatio float64

	UnknownAfter time.Duration
}

func DefaultPolicies() map[Volatility]Policy {
	return map[Volatility]Policy{
		VolatilityStable: {
			FireAfter:    1,
			ClearAfter:   1,
			ClearRatio:   0,
			UnknownAfter: 1 * time.Hour,
		},
		VolatilityProbe: {
			FireAfter:    1,
			ClearAfter:   1,
			ClearRatio:   0,
			UnknownAfter: 1 * time.Hour,
		},
		VolatilityTopology: {
			FireAfter:    1,
			ClearAfter:   1,
			ClearRatio:   0,
			UnknownAfter: 30 * time.Minute,
		},
		VolatilityThreshold: {
			FireAfter:    1,
			ClearAfter:   1,
			ClearRatio:   0,
			UnknownAfter: 1 * time.Hour,
		},
		VolatilityFeed: {
			FireAfter:    1,
			ClearAfter:   1,
			ClearRatio:   0,
			UnknownAfter: 25 * time.Hour,
		},
	}
}
