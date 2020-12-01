// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

// ReceiveIncomingMsg is called by the Rest API layer, or websocket layer (future), when a Remote Cluster
// message is received.  Here we route the message to any topic listeners.
// `rc` and `msg` cannot be nil.
func (rcs *Service) ReceiveIncomingMsg(rc *model.RemoteCluster, msg *model.RemoteClusterMsg) {
	rcs.mux.RLock()
	defer rcs.mux.RUnlock()

	rcSanitized := *rc
	rcSanitized.Token = ""
	rcSanitized.RemoteToken = ""

	listeners := rcs.getTopicListeners(msg.Topic)

	for _, l := range listeners {
		if err := callback(l, msg, &rcSanitized); err != nil {
			rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Error from remote cluster message listener",
				mlog.String("msgId", msg.Id), mlog.String("topic", msg.Topic), mlog.String("remote", rc.DisplayName), mlog.Err(err))
		}
	}
}

func callback(listener TopicListener, msg *model.RemoteClusterMsg, rc *model.RemoteCluster) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%v", r)
		}
	}()
	err = listener.OnReceiveMessage(msg, rc)
	return
}
