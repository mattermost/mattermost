// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type ClusterStats struct {
	Id                        string `json:"id"`
	TotalWebsocketConnections int    `json:"total_websocket_connections"`
	TotalReadDbConnections    int    `json:"total_read_db_connections"`
	TotalMasterDbConnections  int    `json:"total_master_db_connections"`
}

func (me *ClusterStats) ToJson() string {
	b, _ := json.Marshal(me)
	return string(b)
}

func ClusterStatsFromJson(data io.Reader) *ClusterStats {
	var me *ClusterStats
	json.NewDecoder(data).Decode(&me)
	return me
}
