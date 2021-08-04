// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (s *Server) notifyClusterPluginEvent(event model.ClusterEvent, data model.PluginEventData) {
	buf, _ := json.Marshal(data)
	if s.Cluster != nil {
		s.Cluster.SendClusterMessage(&model.ClusterMessage{
			Event:            event,
			SendType:         model.ClusterSendReliable,
			WaitForAllToSend: true,
			Data:             buf,
		})
	}
}
