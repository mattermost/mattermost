// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "time"

// Policy carries only UnknownAfter in Phase A. The debounce/hysteresis fields
// (FireAfter/ClearAfter/ClearRatio) arrive with PR09b, where the reconciler starts reading
// them; adding them back then is additive.
type Policy struct {
	UnknownAfter time.Duration
}

func DefaultPolicies() map[Volatility]Policy {
	return map[Volatility]Policy{
		VolatilityStable:    {UnknownAfter: 1 * time.Hour},
		VolatilityProbe:     {UnknownAfter: 1 * time.Hour},
		VolatilityTopology:  {UnknownAfter: 30 * time.Minute},
		VolatilityThreshold: {UnknownAfter: 1 * time.Hour},
		VolatilityFeed:      {UnknownAfter: 25 * time.Hour},
	}
}
