// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// channelJoinRequestPaginationDefaultPerPage matches the public /api/v4 default
// for paginated endpoints.
const channelJoinRequestPaginationDefaultPerPage = 60

// channelJoinRequestPaginationMaxPerPage caps a single page's size; mirrors the
// 200 cap shared by other public list endpoints.
const channelJoinRequestPaginationMaxPerPage = 200

// requestJoinChannelGuard validates that a user is allowed to express interest
// in joining `channel` and returns a sanitized result for `channel`. Callers
// are expected to look up `channel` via the store before calling this helper.
func (a *App) requestJoinChannelGuard(rctx request.CTX, user *model.User, channel *model.Channel) *model.AppError {
	if channel == nil {
		return model.NewAppError("RequestJoinChannel", "app.channel.get.existing.app_error", nil, "", http.StatusNotFound)
	}

	if channel.DeleteAt != 0 {
		return model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.archived.app_error", nil, "channel_id="+channel.Id, http.StatusBadRequest)
	}

	if channel.Type != model.ChannelTypePrivate {
		return model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.not_private.app_error", nil, "channel_id="+channel.Id, http.StatusBadRequest)
	}

	if !channel.Discoverable {
		return model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.not_discoverable.app_error", nil, "channel_id="+channel.Id, http.StatusForbidden)
	}

	// Shared channels join through their own remote-cluster sync mechanism.
	if channel.IsShared() {
		return model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.shared.app_error", nil, "channel_id="+channel.Id, http.StatusBadRequest)
	}

	if user.IsGuest() {
		return model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.guest.app_error", nil, "user_id="+user.Id, http.StatusForbidden)
	}

	if user.DeleteAt != 0 {
		return model.NewAppError("RequestJoinChannel", "app.channel.add_member.deleted_user.app_error", nil, "", http.StatusForbidden)
	}

	return nil
}

// RequestJoinChannel decides between an immediate ABAC-gated auto-join and an
// asynchronous request-to-join row.
//
// Returns the persisted ChannelJoinRequest when the user must wait for an
// admin review, or nil when the user was added directly to the channel (the
// caller can detect this via the `joined` return value).
func (a *App) RequestJoinChannel(rctx request.CTX, userID, channelID, message string) (joined bool, req *model.ChannelJoinRequest, appErr *model.AppError) {
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return false, nil, appErr
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return false, nil, appErr
	}

	if guardErr := a.requestJoinChannelGuard(rctx, user, channel); guardErr != nil {
		return false, nil, guardErr
	}

	_, memberErr := a.Srv().Store().Channel().GetMember(rctx, channel.Id, user.Id)
	if memberErr == nil {
		return false, nil, model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.already_member.app_error", nil, "channel_id="+channel.Id, http.StatusBadRequest)
	}
	var nfErr *store.ErrNotFound
	if !errors.As(memberErr, &nfErr) {
		return false, nil, model.NewAppError("RequestJoinChannel", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(memberErr)
	}

	enforced, appErr := a.ChannelAccessControlled(rctx, channel.Id)
	if appErr != nil {
		return false, nil, appErr
	}

	// ABAC gate: when an active policy is attached and the user qualifies, add
	// the member directly. AddChannelMember re-runs the PDP gate inside
	// addUserToChannel, so a denial here is authoritative; a non-allow result
	// falls through to the request-row path below ONLY when there is no policy.
	if enforced {
		decision, evalErr := a.evaluateChannelMembership(rctx, user, channel)
		if evalErr != nil {
			return false, nil, evalErr
		}
		if !decision {
			return false, nil, model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.policy_denied.app_error", nil, "channel_id="+channel.Id, http.StatusForbidden)
		}

		if _, err := a.AddChannelMember(rctx, user.Id, channel, ChannelMemberOpts{UserRequestorID: user.Id}); err != nil {
			return false, nil, err
		}
		return true, nil, nil
	}

	pending := &model.ChannelJoinRequest{
		ChannelId: channel.Id,
		UserId:    user.Id,
		Message:   message,
	}

	saved, err := a.Srv().Store().ChannelJoinRequest().Save(pending)
	if err != nil {
		var conflict *store.ErrConflict
		if errors.As(err, &conflict) {
			existing, getErr := a.Srv().Store().ChannelJoinRequest().GetPendingForChannelAndUser(channel.Id, user.Id)
			if getErr == nil {
				return false, existing, nil
			}
			return false, nil, model.NewAppError("RequestJoinChannel", "api.channel.discoverable_join_request.duplicate.app_error", nil, "channel_id="+channel.Id, http.StatusConflict)
		}
		if appErr, ok := err.(*model.AppError); ok {
			return false, nil, appErr
		}
		return false, nil, model.NewAppError("RequestJoinChannel", "app.channel.join_request.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.broadcastChannelJoinRequestCreated(rctx, channel, saved)
	return false, saved, nil
}

// WithdrawChannelJoinRequest flips a pending request the calling user owns to
// the withdrawn state. Non-owners receive a 404 (no oracle on existence) and
// already-terminal rows return 409.
func (a *App) WithdrawChannelJoinRequest(rctx request.CTX, requestID, userID string) (*model.ChannelJoinRequest, *model.AppError) {
	current, err := a.Srv().Store().ChannelJoinRequest().Get(requestID)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("WithdrawChannelJoinRequest", "app.channel.join_request.not_found.app_error", nil, "request_id="+requestID, http.StatusNotFound)
		}
		return nil, model.NewAppError("WithdrawChannelJoinRequest", "app.channel.join_request.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if current.UserId != userID {
		// Hide the row from non-owners by returning the same not-found
		// response. The reviewer flow uses different endpoints.
		return nil, model.NewAppError("WithdrawChannelJoinRequest", "app.channel.join_request.not_found.app_error", nil, "request_id="+requestID, http.StatusNotFound)
	}

	if current.Status != model.ChannelJoinRequestStatusPending {
		return nil, model.NewAppError("WithdrawChannelJoinRequest", "api.channel.discoverable_join_request.not_pending.app_error", nil, "request_id="+requestID, http.StatusConflict)
	}

	current.Status = model.ChannelJoinRequestStatusWithdrawn
	current.Message = ""

	updated, err := a.Srv().Store().ChannelJoinRequest().Update(current)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("WithdrawChannelJoinRequest", "app.channel.join_request.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	channel, channelErr := a.GetChannel(rctx, updated.ChannelId)
	if channelErr != nil {
		// Channel went away mid-flight — still report the update; we just
		// can't broadcast to the admin queue.
		rctx.Logger().Warn("WithdrawChannelJoinRequest: failed to load channel for broadcast", mlog.String("channel_id", updated.ChannelId), mlog.Err(channelErr))
		return updated, nil
	}
	a.broadcastChannelJoinRequestUpdated(rctx, channel, updated)
	return updated, nil
}

// GetMyChannelJoinRequest returns the calling user's active pending request for
// `channelID`, or nil if none exists. It never returns an error for a missing
// row — that's the non-pending state and is expected.
func (a *App) GetMyChannelJoinRequest(rctx request.CTX, userID, channelID string) (*model.ChannelJoinRequest, *model.AppError) {
	req, err := a.Srv().Store().ChannelJoinRequest().GetPendingForChannelAndUser(channelID, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, nil
		}
		return nil, model.NewAppError("GetMyChannelJoinRequest", "app.channel.join_request.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return req, nil
}

// GetMyChannelJoinRequests lists the calling user's join requests across all
// channels. The "My Pending Requests" tab filters by `Status="pending"` (the
// default when opts.Status is empty).
func (a *App) GetMyChannelJoinRequests(rctx request.CTX, userID string, opts model.GetChannelJoinRequestsOpts) (*model.ChannelJoinRequestList, *model.AppError) {
	opts = sanitizeJoinRequestListOpts(opts)
	rows, total, err := a.Srv().Store().ChannelJoinRequest().GetForUser(userID, opts)
	if err != nil {
		return nil, model.NewAppError("GetMyChannelJoinRequests", "app.channel.join_request.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &model.ChannelJoinRequestList{Requests: rows, TotalCount: total}, nil
}

// GetChannelJoinRequests lists the join requests targeting `channelID` for the
// admin queue UI. The visibility check is performed by the API layer via the
// PermissionManageChannelJoinRequests permission.
func (a *App) GetChannelJoinRequests(rctx request.CTX, channelID string, opts model.GetChannelJoinRequestsOpts) (*model.ChannelJoinRequestList, *model.AppError) {
	opts = sanitizeJoinRequestListOpts(opts)
	rows, total, err := a.Srv().Store().ChannelJoinRequest().GetForChannel(channelID, opts)
	if err != nil {
		return nil, model.NewAppError("GetChannelJoinRequests", "app.channel.join_request.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &model.ChannelJoinRequestList{Requests: rows, TotalCount: total}, nil
}

// CountPendingChannelJoinRequests returns the number of pending join requests
// for `channelID`, used by the channel-header badge.
func (a *App) CountPendingChannelJoinRequests(rctx request.CTX, channelID string) (int64, *model.AppError) {
	count, err := a.Srv().Store().ChannelJoinRequest().CountPending(channelID)
	if err != nil {
		return 0, model.NewAppError("CountPendingChannelJoinRequests", "app.channel.join_request.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count, nil
}

// UpdateChannelJoinRequest applies an admin review (approve / deny) to a
// pending request. When approving, the user is added via AddChannelMember so
// the existing PDP gate inside addUserToChannel re-runs — admins cannot bypass
// an active ABAC policy. The store row is only updated after a successful add
// to keep the audit trail consistent.
func (a *App) UpdateChannelJoinRequest(rctx request.CTX, requestID, channelID string, patch *model.ChannelJoinRequestPatch, reviewerID string) (*model.ChannelJoinRequest, *model.AppError) {
	if patch == nil {
		return nil, model.NewAppError("UpdateChannelJoinRequest", "api.channel.discoverable_join_request.invalid_patch.app_error", nil, "", http.StatusBadRequest)
	}

	switch patch.Status {
	case model.ChannelJoinRequestStatusApproved, model.ChannelJoinRequestStatusDenied:
	default:
		return nil, model.NewAppError("UpdateChannelJoinRequest", "api.channel.discoverable_join_request.invalid_patch.app_error", nil, "status="+patch.Status, http.StatusBadRequest)
	}

	current, err := a.Srv().Store().ChannelJoinRequest().Get(requestID)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("UpdateChannelJoinRequest", "app.channel.join_request.not_found.app_error", nil, "request_id="+requestID, http.StatusNotFound)
		}
		return nil, model.NewAppError("UpdateChannelJoinRequest", "app.channel.join_request.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Defense in depth: refuse cross-channel updates so a forged request id
	// can't be reviewed against a channel the admin happens to own.
	if current.ChannelId != channelID {
		return nil, model.NewAppError("UpdateChannelJoinRequest", "app.channel.join_request.not_found.app_error", nil, "request_id="+requestID, http.StatusNotFound)
	}

	if current.Status != model.ChannelJoinRequestStatusPending {
		return nil, model.NewAppError("UpdateChannelJoinRequest", "api.channel.discoverable_join_request.not_pending.app_error", nil, "request_id="+requestID, http.StatusConflict)
	}

	channel, appErr := a.GetChannel(rctx, current.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	if patch.Status == model.ChannelJoinRequestStatusApproved {
		if _, err := a.AddChannelMember(rctx, current.UserId, channel, ChannelMemberOpts{UserRequestorID: reviewerID}); err != nil {
			return nil, err
		}
	}

	current.Status = patch.Status
	current.ReviewedBy = reviewerID
	current.ReviewedAt = model.GetMillis()
	current.DenialReason = ""
	if patch.Status == model.ChannelJoinRequestStatusDenied && patch.DenialReason != nil {
		current.DenialReason = *patch.DenialReason
	}
	// Drop the original message from the response; it served its purpose
	// during review and keeping it would leak free-text into the audit trail.
	current.Message = ""

	updated, err := a.Srv().Store().ChannelJoinRequest().Update(current)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("UpdateChannelJoinRequest", "app.channel.join_request.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.broadcastChannelJoinRequestUpdated(rctx, channel, updated)
	return updated, nil
}

// sanitizeJoinRequestListOpts clamps user-provided pagination + status options
// so the store sees a normalized request.
func sanitizeJoinRequestListOpts(opts model.GetChannelJoinRequestsOpts) model.GetChannelJoinRequestsOpts {
	if opts.Status == "" {
		opts.Status = model.ChannelJoinRequestStatusPending
	} else if !model.IsValidChannelJoinRequestStatus(opts.Status) {
		opts.Status = model.ChannelJoinRequestStatusPending
	}
	if opts.Page < 0 {
		opts.Page = 0
	}
	if opts.PerPage <= 0 {
		opts.PerPage = channelJoinRequestPaginationDefaultPerPage
	} else if opts.PerPage > channelJoinRequestPaginationMaxPerPage {
		opts.PerPage = channelJoinRequestPaginationMaxPerPage
	}
	return opts
}

// evaluateChannelMembership runs the access-control PDP for `user` against the
// `membership` action on `channel`, returning the boolean decision. Errors
// from the PDP are returned to callers so they can choose between the
// "channel is invisible" (visibility filter) or "channel cannot be joined"
// (request flow) fail-secure semantics. Callers must have already verified
// that `channel.PolicyEnforced` is true before invoking the PDP.
func (a *App) evaluateChannelMembership(rctx request.CTX, user *model.User, channel *model.Channel) (bool, *model.AppError) {
	acs := a.Srv().Channels().AccessControl
	if acs == nil {
		// No ABAC service → fail-secure. The channel acts as if the user did
		// not satisfy the policy.
		return false, nil
	}

	subject, appErr := a.BuildAccessControlSubject(rctx, user.Id, user.Roles, channel.Id)
	if appErr != nil {
		return false, appErr
	}

	decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
		Subject: *subject,
		Resource: model.Resource{
			Type: model.AccessControlPolicyTypeChannel,
			ID:   channel.Id,
		},
		Action: "membership",
	})
	if evalErr != nil {
		return false, evalErr
	}
	return decision.Decision, nil
}

// channelAdminUserIDs returns the user ids of channel members with the
// scheme-admin role on `channelID`. Used to scope WS broadcasts of join-request
// events to the queue audience. Failures bubble up because broadcasting to no
// one would silently break the admin UI.
func (a *App) channelAdminUserIDs(rctx request.CTX, channelID string) ([]string, *model.AppError) {
	const channelMembersPageSize = 200

	admins := []string{}
	page := 0
	for {
		members, err := a.Srv().Store().Channel().GetMembers(model.ChannelMembersGetOptions{
			ChannelID: channelID,
			Offset:    page * channelMembersPageSize,
			Limit:     channelMembersPageSize,
		})
		if err != nil {
			return nil, model.NewAppError("channelAdminUserIDs", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		for _, m := range members {
			if m.SchemeAdmin {
				admins = append(admins, m.UserId)
			}
		}
		if len(members) < channelMembersPageSize {
			break
		}
		page++
	}
	return admins, nil
}

// broadcastChannelJoinRequestCreated fires a channel_join_request_created event
// scoped to the channel admin set, using the OnlyChannelAdmins broadcast hook
// to filter out non-admin members the channel-id broadcast would otherwise
// reach.
func (a *App) broadcastChannelJoinRequestCreated(rctx request.CTX, channel *model.Channel, req *model.ChannelJoinRequest) {
	a.publishChannelJoinRequestEvent(rctx, channel, req, model.WebsocketEventChannelJoinRequestCreated, true /* adminsOnly */)
}

// broadcastChannelJoinRequestUpdated fires a channel_join_request_updated event
// to the channel admin set + the requesting user (so their My Pending Requests
// list reacts in real-time).
func (a *App) broadcastChannelJoinRequestUpdated(rctx request.CTX, channel *model.Channel, req *model.ChannelJoinRequest) {
	// Send a dedicated copy to the requester so an offline-but-then-reconnected
	// requester gets their own row update even when they are not a channel
	// member yet (the channel-id broadcast wouldn't reach them otherwise).
	if req.UserId != "" {
		userMessage := model.NewWebSocketEvent(model.WebsocketEventChannelJoinRequestUpdated, "", "", req.UserId, nil, "")
		userMessage.Add("request", marshalChannelJoinRequest(rctx, req))
		userMessage.Add("channel_id", channel.Id)
		a.Publish(userMessage)
	}
	a.publishChannelJoinRequestEvent(rctx, channel, req, model.WebsocketEventChannelJoinRequestUpdated, true /* adminsOnly */)
}

func (a *App) publishChannelJoinRequestEvent(rctx request.CTX, channel *model.Channel, req *model.ChannelJoinRequest, event model.WebsocketEventType, adminsOnly bool) {
	message := model.NewWebSocketEvent(event, "", channel.Id, "", nil, "")
	message.Add("request", marshalChannelJoinRequest(rctx, req))
	message.Add("channel_id", channel.Id)

	if adminsOnly {
		admins, appErr := a.channelAdminUserIDs(rctx, channel.Id)
		if appErr != nil {
			rctx.Logger().Warn("Failed to compute channel admin set for join request broadcast",
				mlog.String("channel_id", channel.Id),
				mlog.Err(appErr),
			)
			return
		}
		useOnlyChannelAdminsHook(message, admins)
	}
	a.Publish(message)
}

// marshalChannelJoinRequest returns the request as a JSON string for the WS
// payload. JSON encoding errors are logged and the payload is delivered as an
// empty string so the event still arrives (clients can tolerate a missing
// request body and refetch).
func marshalChannelJoinRequest(rctx request.CTX, req *model.ChannelJoinRequest) string {
	if req == nil {
		return ""
	}
	buf, err := json.Marshal(req)
	if err != nil {
		rctx.Logger().Warn("Failed to marshal ChannelJoinRequest for WS broadcast",
			mlog.String("request_id", req.Id),
			mlog.Err(err),
		)
		return ""
	}
	return string(buf)
}
