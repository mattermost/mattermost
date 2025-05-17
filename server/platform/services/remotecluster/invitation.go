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
func (rcs *Service) AcceptInvitation(invite *model.RemoteClusterInvite, name string, displayName string, creatorId string, siteURL string, defaultTeamId string) (*model.RemoteCluster, error) {
	// Generate new token for RemoteToken only if invite version is 2 or greater
	var remoteToken string
	if invite.Version >= 2 {
		remoteToken = model.NewId() // Generate new token for v2+ protocol
	} else {
		remoteToken = invite.Token // Use the token from the invite for backwards compatibility
	}

	rc := &model.RemoteCluster{
		RemoteId:      invite.RemoteId,
		Name:          name,
		DisplayName:   displayName,
		DefaultTeamId: defaultTeamId,
		Token:         model.NewId(),
		RemoteToken:   remoteToken,
		SiteURL:       invite.SiteURL,
		CreatorId:     creatorId,
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

	// for the invite confirm message, we need to use the token that
	// the originating server sent in the invite instead of the one
	// we're storing as a refresh
	rc.RemoteToken = invite.Token

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

func makeConfirmFrame(rc *model.RemoteCluster, siteURL string) (*model.RemoteClusterFrame, error) {
	confirm := model.RemoteClusterInvite{
		RemoteId:       rc.RemoteId,
		SiteURL:        siteURL,
		Token:          rc.Token,
		RefreshedToken: rc.RemoteToken,
		Version:        2,
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
