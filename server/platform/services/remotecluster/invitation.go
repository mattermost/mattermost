// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

// AcceptInvitation is called when accepting an invitation to connect with a remote cluster.
func (rcs *Service) AcceptInvitation(invite *model.RemoteClusterInvite, name string, displayName, creatorId string, teamId string, siteURL string) (*model.RemoteCluster, error) {
	rc := &model.RemoteCluster{
		RemoteId:     invite.RemoteId,
		RemoteTeamId: invite.RemoteTeamId,
		Name:         name,
		DisplayName:  displayName,
		Token:        model.NewId(),
		RemoteToken:  invite.Token,
		SiteURL:      invite.SiteURL,
		CreatorId:    creatorId,
	}

	rcSaved, err := rcs.server.GetStore().RemoteCluster().Save(rc)
	if err != nil {
		return nil, err
	}

	// confirm the invitation with the originating site
	frame, err := makeConfirmFrame(rcSaved, teamId, siteURL)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s", rcSaved.SiteURL, ConfirmInviteURL)

	resp, err := rcs.sendFrameToRemote(PingTimeout, rc, frame, url)
	if err != nil {
		rcs.server.GetStore().RemoteCluster().Delete(rcSaved.RemoteId)
		return nil, err
	}

	var response Response
	err = json.Unmarshal(resp, &response)
	if err != nil {
		rcs.server.GetStore().RemoteCluster().Delete(rcSaved.RemoteId)
		return nil, fmt.Errorf("invalid response from remote server: %w", err)
	}

	if !response.IsSuccess() {
		rcs.server.GetStore().RemoteCluster().Delete(rcSaved.RemoteId)
		return nil, errors.New(response.Err)
	}

	// issue the first ping right away. The goroutine will exit when ping completes or PingTimeout exceeded.
	go rcs.PingNow(rcSaved)

	return rcSaved, nil
}

func makeConfirmFrame(rc *model.RemoteCluster, teamId string, siteURL string) (*model.RemoteClusterFrame, error) {
	confirm := model.RemoteClusterInvite{
		RemoteId:     rc.RemoteId,
		RemoteTeamId: teamId,
		SiteURL:      siteURL,
		Token:        rc.Token,
	}
	confirmRaw, err := json.Marshal(confirm)
	if err != nil {
		return nil, err
	}

	msg := model.NewRemoteClusterMsg(InvitationTopic, confirmRaw)

	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Msg:      msg,
	}
	return frame, nil
}
