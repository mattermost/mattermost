// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ip_filtering

type IPFilterProvider interface {
	ApplyIPFilters(allowedIPRanges *AllowedIPRanges) error
	GetIPFilters() (*AllowedIPRanges, error)
}

// TODO: Should these just be in the model package? The current implementation for Cloud,
// which needs to reach out to enterprise layer, so using these causes a circular dependency
// I would expect a "first party" implementation (ie, not cloud) to be able to simply use these,
// making the service more or less completely contained
type AllowedIPRanges []AllowedIPRange

type AllowedIPRange struct {
	CIDRBlock   string
	Description string
	Enabled     bool
	OwnerID     string
}
