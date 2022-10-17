// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"
)

func (a *App) GetThreadsForUser(userID, teamID string, options model.GetUserThreadsOpts) (*model.Threads, *model.AppError) {
	var result model.Threads
	var eg errgroup.Group

	if !options.ThreadsOnly {
		eg.Go(func() error {
			totalUnreadThreads, err := a.Srv().Store().Thread().GetTotalUnreadThreads(userID, teamID, options)
			if err != nil {
				return errors.Wrapf(err, "failed to count unread threads for user id=%s", userID)
			}
			result.TotalUnreadThreads = totalUnreadThreads

			return nil
		})

		// Unread is a legacy flag that caused GetTotalThreads to compute the same value as
		// GetTotalUnreadThreads. If unspecified, do this work normally; otherwise, skip,
		// and send back duplicate values down below.
		if !options.Unread {
			eg.Go(func() error {
				totalCount, err := a.Srv().Store().Thread().GetTotalThreads(userID, teamID, options)
				if err != nil {
					return errors.Wrapf(err, "failed to count threads for user id=%s", userID)
				}
				result.Total = totalCount

				return nil
			})
		}

		eg.Go(func() error {
			totalUnreadMentions, err := a.Srv().Store().Thread().GetTotalUnreadMentions(userID, teamID, options)
			if err != nil {
				return errors.Wrapf(err, "failed to count threads for user id=%s", userID)
			}
			result.TotalUnreadMentions = totalUnreadMentions

			return nil
		})
	}

	if !options.TotalsOnly {
		eg.Go(func() error {
			threads, err := a.Srv().Store().Thread().GetThreadsForUser(userID, teamID, options)
			if err != nil {
				return errors.Wrapf(err, "failed to get threads for user id=%s", userID)
			}
			result.Threads = threads

			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, model.NewAppError("GetThreadsForUser", "app.user.get_threads_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if options.Unread {
		result.Total = result.TotalUnreadThreads
	}

	for _, thread := range result.Threads {
		a.SanitizeProfiles(thread.Participants, false)
		thread.Post.SanitizeProps()
	}

	return &result, nil
}

func (a *App) GetThreadMembershipForUser(userId, threadId string) (*model.ThreadMembership, *model.AppError) {
	threadMembership, err := a.Srv().Store().Thread().GetMembershipForUser(userId, threadId)
	if err != nil {
		return nil, model.NewAppError("GetThreadMembershipForUser", "app.user.get_thread_membership_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if threadMembership == nil {
		return nil, model.NewAppError("GetThreadMembershipForUser", "app.user.get_thread_membership_for_user.not_found", nil, "thread membership not found/followed", http.StatusNotFound)
	}
	return threadMembership, nil
}

func (a *App) GetThreadForUser(teamID string, threadMembership *model.ThreadMembership, extended bool) (*model.ThreadResponse, *model.AppError) {
	thread, err := a.Srv().Store().Thread().GetThreadForUser(teamID, threadMembership, extended)
	if err != nil {
		return nil, model.NewAppError("GetThreadForUser", "app.user.get_threads_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if thread == nil {
		return nil, model.NewAppError("GetThreadForUser", "app.user.get_threads_for_user.not_found", nil, "thread not found/followed", http.StatusNotFound)
	}
	a.SanitizeProfiles(thread.Participants, false)
	thread.Post.SanitizeProps()
	return thread, nil
}

func (a *App) UpdateThreadsReadForUser(userID, teamID string) *model.AppError {
	nErr := a.Srv().Store().Thread().MarkAllAsReadByTeam(userID, teamID)
	if nErr != nil {
		return model.NewAppError("UpdateThreadsReadForUser", "app.user.update_threads_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	message := model.NewWebSocketEvent(model.WebsocketEventThreadReadChanged, teamID, "", userID, nil, "")
	a.Publish(message)
	return nil
}

func (a *App) UpdateThreadFollowForUser(userID, teamID, threadID string, state bool) *model.AppError {
	opts := store.ThreadMembershipOpts{
		Following:             state,
		IncrementMentions:     false,
		UpdateFollowing:       true,
		UpdateViewedTimestamp: state,
		UpdateParticipants:    false,
	}
	_, err := a.Srv().Store().Thread().MaintainMembership(userID, threadID, opts)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUser", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	thread, err := a.Srv().Store().Thread().Get(threadID)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUser", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	replyCount := int64(0)
	if thread != nil {
		replyCount = thread.ReplyCount
	}
	message := model.NewWebSocketEvent(model.WebsocketEventThreadFollowChanged, teamID, "", userID, nil, "")
	message.Add("thread_id", threadID)
	message.Add("state", state)
	message.Add("reply_count", replyCount)
	a.Publish(message)
	return nil
}

func (a *App) UpdateThreadFollowForUserFromChannelAdd(c request.CTX, userID, teamID, threadID string) *model.AppError {
	opts := store.ThreadMembershipOpts{
		Following:             true,
		IncrementMentions:     false,
		UpdateFollowing:       true,
		UpdateViewedTimestamp: false,
		UpdateParticipants:    false,
	}
	tm, err := a.Srv().Store().Thread().MaintainMembership(userID, threadID, opts)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	post, appErr := a.GetSinglePost(threadID, false)
	if appErr != nil {
		return appErr
	}
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return appErr
	}
	tm.UnreadMentions, appErr = a.countThreadMentions(c, user, post, teamID, post.CreateAt-1)
	if appErr != nil {
		return appErr
	}
	tm.LastViewed = post.CreateAt - 1
	_, err = a.Srv().Store().Thread().UpdateMembership(tm)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventThreadUpdated, teamID, "", userID, nil, "")
	userThread, err := a.Srv().Store().Thread().GetThreadForUser(teamID, tm, true)

	if err != nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return nil
		}
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	a.SanitizeProfiles(userThread.Participants, false)
	userThread.Post.SanitizeProps()
	sanitizedPost, appErr := a.SanitizePostMetadataForUser(c, userThread.Post, userID)
	if appErr != nil {
		return appErr
	}
	userThread.Post = sanitizedPost

	payload, jsonErr := json.Marshal(userThread)
	if jsonErr != nil {
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("thread", string(payload))
	message.Add("previous_unread_replies", int64(0))
	message.Add("previous_unread_mentions", int64(0))

	a.Publish(message)
	return nil
}

func (a *App) UpdateThreadReadForUserByPost(c request.CTX, currentSessionId, userID, teamID, threadID, postID string) (*model.ThreadResponse, *model.AppError) {
	post, err := a.GetSinglePost(postID, false)
	if err != nil {
		return nil, err
	}

	if post.RootId != threadID && postID != threadID {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user_by_post.app_error", nil, "", http.StatusBadRequest)
	}

	return a.UpdateThreadReadForUser(c, currentSessionId, userID, teamID, threadID, post.CreateAt-1)
}

func (a *App) UpdateThreadReadForUser(c request.CTX, currentSessionId, userID, teamID, threadID string, timestamp int64) (*model.ThreadResponse, *model.AppError) {
	user, err := a.GetUser(userID)
	if err != nil {
		return nil, err
	}

	opts := store.ThreadMembershipOpts{
		Following:       true,
		UpdateFollowing: true,
	}
	membership, storeErr := a.Srv().Store().Thread().MaintainMembership(userID, threadID, opts)
	if storeErr != nil {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	previousUnreadMentions := membership.UnreadMentions
	previousUnreadReplies, nErr := a.Srv().Store().Thread().GetThreadUnreadReplyCount(membership)
	if nErr != nil {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	post, err := a.GetSinglePost(threadID, false)
	if err != nil {
		return nil, err
	}
	membership.UnreadMentions, err = a.countThreadMentions(c, user, post, teamID, timestamp)
	if err != nil {
		return nil, err
	}
	_, nErr = a.Srv().Store().Thread().UpdateMembership(membership)
	if nErr != nil {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	membership.LastViewed = timestamp

	nErr = a.Srv().Store().Thread().MarkAsRead(userID, threadID, timestamp)
	if nErr != nil {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	thread, err := a.GetThreadForUser(teamID, membership, false)
	if err != nil {
		return nil, err
	}

	// Clear if user has read the messages
	if thread.UnreadReplies == 0 && a.IsCRTEnabledForUser(c, userID) {
		a.clearPushNotification(currentSessionId, userID, post.ChannelId, threadID)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventThreadReadChanged, teamID, "", userID, nil, "")
	message.Add("thread_id", threadID)
	message.Add("timestamp", timestamp)
	message.Add("unread_mentions", membership.UnreadMentions)
	message.Add("unread_replies", thread.UnreadReplies)
	message.Add("previous_unread_mentions", previousUnreadMentions)
	message.Add("previous_unread_replies", previousUnreadReplies)
	message.Add("channel_id", post.ChannelId)
	a.Publish(message)
	return thread, nil
}
