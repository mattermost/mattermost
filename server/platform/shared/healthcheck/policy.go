// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "time"

type Policy struct {
	// UnknownAfter is how long a finding may go unevaluated before it ages to unknown.
	// Aging is checked only once per collection cycle, so a value below the collection
	// interval cannot age sooner than the first absent cycle; express it in whole ticks
	// plus slack (sub-interval values carry no extra information).
	UnknownAfter time.Duration
}

func DefaultPolicies() map[Volatility]Policy {
	return map[Volatility]Policy{
		VolatilityStable:    {UnknownAfter: 2 * time.Hour},
		VolatilityProbe:     {UnknownAfter: 2 * time.Hour},
		VolatilityTopology:  {UnknownAfter: 1 * time.Hour},
		VolatilityThreshold: {UnknownAfter: 2 * time.Hour},
		VolatilityFeed:      {UnknownAfter: 25 * time.Hour},
	}
}
