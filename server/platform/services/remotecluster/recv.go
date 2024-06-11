// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// ReceiveIncomingMsg is called by the Rest API layer, or websocket layer (future), when a Remote Cluster
// message is received.  Here we route the message to any topic listeners.
// `rc` and `msg` cannot be nil.
func (rcs *Service) ReceiveIncomingMsg(rc *model.RemoteCluster, msg model.RemoteClusterMsg) Response {
	rcs.mux.RLock()
	defer rcs.mux.RUnlock()

	if metrics := rcs.server.GetMetrics(); metrics != nil {
		metrics.IncrementRemoteClusterMsgReceivedCounter(rc.RemoteId)
	}

	rcSanitized := *rc
	rcSanitized.Token = ""
	rcSanitized.RemoteToken = ""

	var response Response
	response.Status = ResponseStatusOK

	listeners := rcs.getTopicListeners(msg.Topic)

	for _, l := range listeners {
		if err := callback(l, msg, &rcSanitized, &response); err != nil {
			rcs.server.Log().Log(mlog.LvlRemoteClusterServiceError, "Error from remote cluster message listener",
				mlog.String("msgId", msg.Id), mlog.String("topic", msg.Topic), mlog.String("remote", rc.DisplayName), mlog.Err(err))

			response.Status = ResponseStatusFail
			response.Err = err.Error()
		}
	}
	return response
}

func callback(listener TopicListener, msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%v", r)
		}
	}()
	err = listener(msg, rc, resp)
	return
}

// ReceiveInviteConfirmation is called by the Rest API layer when a Remote Cluster accepts an invitation from this
// local cluster.
func (rcs *Service) ReceiveInviteConfirmation(confirm model.RemoteClusterInvite) (*model.RemoteCluster, error) {
	store := rcs.server.GetStore().RemoteCluster()

	rc, err := store.Get(confirm.RemoteId)
	if err != nil {
		return nil, fmt.Errorf("cannot accept invite confirmation for remote %s: %w", confirm.RemoteId, err)
	}

	rc.RemoteTeamId = confirm.RemoteTeamId
	rc.SiteURL = confirm.SiteURL
	rc.RemoteToken = confirm.Token

	rcUpdated, err := store.Update(rc)
	if err != nil {
		return nil, fmt.Errorf("cannot apply invite confirmation for remote %s: %w", confirm.RemoteId, err)
	}

	// issue the first ping right away. The goroutine will exit when ping completes or PingTimeout exceeded.
	go rcs.PingNow(rcUpdated)

	return rcUpdated, nil
}
