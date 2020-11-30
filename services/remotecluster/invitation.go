// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (rcs *RemoteClusterService) AcceptInvitation(invite *model.RemoteClusterInvite, name string, siteURL string) (*model.RemoteCluster, error) {
	rc := &model.RemoteCluster{
		RemoteId:    invite.RemoteId,
		DisplayName: name,
		Token:       model.NewId(),
		RemoteToken: invite.Token,
		SiteURL:     invite.SiteURL,
	}

	rcSaved, err := rcs.server.GetStore().RemoteCluster().Save(rc)
	if err != nil {
		return nil, err
	}

	// confirm the invitation with the originating site
	frame, err := makeConfirmFrame(rcSaved, siteURL)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s", rcSaved.SiteURL, ConfirmInviteURL)

	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*PingTimeoutMillis)
	defer cancel()

	if _, err := rcs.sendFrameToRemote(ctx, frame, url); err != nil {
		return nil, err
	}
	return rcSaved, nil
}

func makeConfirmFrame(rc *model.RemoteCluster, siteURL string) (*model.RemoteClusterFrame, error) {
	confirm := model.RemoteClusterInvite{
		RemoteId: rc.RemoteId,
		SiteURL:  siteURL,
		Token:    rc.Token,
	}
	confirmRaw, err := json.Marshal(confirm)
	if err != nil {
		return nil, err
	}

	msg := &model.RemoteClusterMsg{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Payload:  confirmRaw,
	}

	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Token:    rc.RemoteToken,
		Msg:      msg,
	}
	return frame, nil
}
