// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "time"

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
