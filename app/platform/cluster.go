// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import "github.com/mattermost/mattermost-server/v6/einterfaces"

func (ps *PlatformService) IsLeader() bool {
	if ps.License() != nil && *ps.Config().ClusterSettings.Enable && ps.cluster != nil {
		return ps.cluster.IsLeader()
	}

	return true
}

func (ps *PlatformService) SetCluster(impl einterfaces.ClusterInterface) {
	ps.cluster = impl
}
