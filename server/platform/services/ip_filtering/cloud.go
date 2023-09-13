// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ip_filtering

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type MattermostCloud struct {
	Cloud einterfaces.CloudInterface
}

func NewIPFilteringProvider(cloud einterfaces.CloudInterface) IPFilterProvider {
	return &MattermostCloud{Cloud: cloud}
}

func cloudRangeToRange(r *model.AllowedIPRanges) *AllowedIPRanges {
	if r == nil {
		return nil
	}

	ranges := &AllowedIPRanges{}

	for _, r := range *r {
		*ranges = append(*ranges, AllowedIPRange{
			CIDRBlock:   r.CIDRBlock,
			Description: r.Description,
			Enabled:     r.Enabled,
			OwnerID:     r.OwnerID,
		})
	}

	return ranges
}

func rangeToCloudRange(r *AllowedIPRanges) *model.AllowedIPRanges {
	if r == nil {
		return nil
	}

	ranges := &model.AllowedIPRanges{}

	for _, r := range *r {
		*ranges = append(*ranges, model.AllowedIPRange{
			CIDRBlock:   r.CIDRBlock,
			Description: r.Description,
			Enabled:     r.Enabled,
			OwnerID:     r.OwnerID,
		})
	}

	return ranges
}

func (m *MattermostCloud) ApplyIPFilters(allowedIPRanges *AllowedIPRanges) error {
	// TODO: UserID?
	return m.Cloud.ApplyIPFilters("", rangeToCloudRange(allowedIPRanges))
}

func (m *MattermostCloud) GetIPFilters() (*AllowedIPRanges, error) {
	// TODO: UserID?
	ranges, err := m.Cloud.GetIPFilters("")
	if err != nil {
		return nil, err
	}
	return cloudRangeToRange(ranges), nil
}
