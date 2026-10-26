// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const remoteInvitationExpiredErrorId = "api.context.invitation_expired.error"

// AcceptInvitation is called when accepting an invitation to connect with a remote cluster.
// Text supplied by the remote, such as its rejection reason, is only logged and never becomes
// part of the returned error.
func (rcs *Service) AcceptInvitation(invite *model.RemoteClusterInvite, name string, displayName string, creatorId string, siteURL string, defaultTeamId string) (*model.RemoteCluster, *model.AppError) {
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
		if appErr, ok := errors.AsType[*model.AppError](err); ok {
			return nil, appErr
		}
		if _, ok := errors.AsType[*store.ErrConflict](err); ok {
			return nil, model.NewAppError("AcceptInvitation", "api.remote_cluster.save_not_unique.app_error", nil, "", http.StatusConflict).Wrap(err)
		}
		return nil, model.NewAppError("AcceptInvitation", "api.remote_cluster.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// The connection was never established, so the row is removed outright; a soft-deleted
	// row would keep its primary key and block retrying the same invite with the same name.
	confirmed := false
	defer func() {
		if confirmed {
			return
		}
		if delErr := rcs.server.GetStore().RemoteCluster().PermanentDelete(rcSaved.RemoteId, rcSaved.Name); delErr != nil {
			rcs.server.Log().Warn("Failed to delete unconfirmed remote cluster", mlog.String("remote_id", rcSaved.RemoteId), mlog.Err(delErr))
		}
	}()

	// confirm the invitation with the originating site
	frame, err := makeConfirmFrame(rcSaved, siteURL)
	if err != nil {
		return nil, model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	url := fmt.Sprintf("%s/%s", rcSaved.SiteURL, ConfirmInviteURL)

	// for the invite confirm message, we need to use the token that
	// the originating server sent in the invite instead of the one
	// we're storing as a refresh
	rc.RemoteToken = invite.Token

	resp, err := rcs.sendFrameToRemote(PingTimeout, rc, frame, url)
	if err != nil {
		return nil, rcs.confirmInviteSendError(rcSaved.RemoteId, url, resp, err)
	}

	var response Response
	err = json.Unmarshal(resp, &response)
	if err != nil {
		return nil, model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.invalid_response.app_error", nil, "", http.StatusBadGateway).Wrap(err)
	}

	if !response.IsSuccess() {
		rcs.server.Log().Warn("Remote site rejected the invitation", mlog.String("remote_id", rcSaved.RemoteId), mlog.String("reason", response.Err))
		return nil, model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.rejected.app_error", nil, "", http.StatusBadGateway)
	}

	confirmed = true

	// issue the first ping right away. The goroutine will exit when ping completes or PingTimeout exceeded.
	go rcs.PingNow(rcSaved)

	return rcSaved, nil
}

// confirmInviteSendError maps a failed confirm_invite request to an AppError. resp is the body the remote
// answered with alongside a non-200 status, if any; its AppError id picks a local translation and its message is only logged.
// A body with a status code but no id still counts as a refusal, since hardened mode blanks the id of every 5xx.
func (rcs *Service) confirmInviteSendError(remoteId string, url string, resp []byte, err error) *model.AppError {
	if errors.Is(err, errRemoteUnreachable) {
		return model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.unreachable.app_error", map[string]any{"URL": markdownSafeURL(url)}, "", http.StatusBadGateway).Wrap(err)
	}
	if errors.Is(err, errInvalidRemoteURL) {
		return model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.invalid_url.app_error", map[string]any{"URL": markdownSafeURL(url)}, "", http.StatusBadRequest).Wrap(err)
	}
	if errors.Is(err, errRemoteResponseTooLarge) {
		return model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.invalid_response.app_error", nil, "", http.StatusBadGateway).Wrap(err)
	}
	if resp == nil {
		return model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var remoteErr model.AppError
	if jsonErr := json.Unmarshal(resp, &remoteErr); jsonErr != nil || (remoteErr.Id == "" && remoteErr.StatusCode == 0) {
		return model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.invalid_response.app_error", nil, "", http.StatusBadGateway).Wrap(err)
	}

	rcs.server.Log().Warn("Remote site refused the invitation", mlog.String("remote_id", remoteId), mlog.String("remote_error_id", remoteErr.Id), mlog.String("reason", remoteErr.Message), mlog.Err(err))
	if remoteErr.Id == remoteInvitationExpiredErrorId {
		return model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.expired.app_error", nil, "", http.StatusBadGateway).Wrap(err)
	}
	return model.NewAppError("AcceptInvitation", "api.remote_cluster.accept_invitation.rejected.app_error", nil, "", http.StatusBadGateway).Wrap(err)
}

// markdownSafeURL percent-encodes every byte that markdown could interpret, since the URL comes
// from the invite and is rendered in the slash command reply.
func markdownSafeURL(u string) string {
	var sb strings.Builder
	for i := range len(u) {
		c := u[i]
		if isMarkdownSafeURLByte(c) {
			sb.WriteByte(c)
		} else {
			fmt.Fprintf(&sb, "%%%02X", c)
		}
	}
	return sb.String()
}

func isMarkdownSafeURLByte(c byte) bool {
	switch {
	case 'a' <= c && c <= 'z', 'A' <= c && c <= 'Z', '0' <= c && c <= '9':
		return true
	}
	return strings.IndexByte("-._:/?&=+%,;", c) >= 0
}

func makeConfirmFrame(rc *model.RemoteCluster, siteURL string) (*model.RemoteClusterFrame, error) {
	confirm := model.RemoteClusterInvite{
		RemoteId:       rc.RemoteId,
		SiteURL:        siteURL,
		Token:          rc.Token,
		RefreshedToken: rc.RemoteToken,
		Version:        3,
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
