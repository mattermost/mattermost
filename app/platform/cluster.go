// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

func (ps *PlatformService) IsLeader() bool {
	if ps.License() != nil && *ps.Config().ClusterSettings.Enable && ps.cluster != nil {
		return ps.cluster.IsLeader()
	}

	return true
}
