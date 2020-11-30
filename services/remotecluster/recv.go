// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import "github.com/mattermost/mattermost-server/v5/model"

// ReceiveIncomingMsg is called by the Rest API layer, or websocket layer (future), when a Remote Cluster
// message is received.  Here we asynchronously route the message to any topic listeners.
func (rcs *RemoteClusterService) ReceiveIncomingMsg(rc *model.RemoteCluster, msg *model.RemoteClusterMsg) {

}
