// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

type sendSyncMsgResultFunc func(syncResp model.SyncResponse, err error)

type attachment struct {
	fi   *model.FileInfo
	post *model.Post
}

type syncData struct {
	task syncTask
	rc   *model.RemoteCluster
	scr  *model.SharedChannelRemote

	users             map[string]*model.User
	profileImages     map[string]*model.User
	posts             []*model.Post
	reactions         []*model.Reaction
	acknowledgements  []*model.PostAcknowledgement
	statuses          []*model.Status
	attachments       []attachment
	mentionTransforms map[string]string

	resultRepeat                bool
	resultNextCursor            model.GetPostsSinceForSyncCursor
	GlobalUserSyncLastTimestamp int64
}

func newSyncData(task syncTask, rc *model.RemoteCluster, scr *model.SharedChannelRemote) *syncData {
	return &syncData{
		task:              task,
		rc:                rc,
		scr:               scr,
		users:             make(map[string]*model.User),
		profileImages:     make(map[string]*model.User),
		mentionTransforms: make(map[string]string),
		resultNextCursor: model.GetPostsSinceForSyncCursor{
			LastPostUpdateAt: scr.LastPostUpdateAt, LastPostUpdateID: scr.LastPostUpdateID,
			LastPostCreateAt: scr.LastPostCreateAt, LastPostCreateID: scr.LastPostCreateID,
		},
	}
}

func (sd *syncData) isEmpty() bool {
	return len(sd.users) == 0 && len(sd.profileImages) == 0 && len(sd.posts) == 0 && len(sd.reactions) == 0 && len(sd.acknowledgements) == 0 && len(sd.attachments) == 0
}

func (sd *syncData) isCursorChanged() bool {
	if sd.resultNextCursor.IsEmpty() {
		return false
	}

	return sd.scr.LastPostCreateAt != sd.resultNextCursor.LastPostCreateAt || sd.scr.LastPostCreateID != sd.resultNextCursor.LastPostCreateID ||
		sd.scr.LastPostUpdateAt != sd.resultNextCursor.LastPostUpdateAt || sd.scr.LastPostUpdateID != sd.resultNextCursor.LastPostUpdateID
}

func (sd *syncData) setDataFromMsg(msg *model.SyncMsg) {
	sd.users = msg.Users
	sd.posts = msg.Posts
	sd.reactions = msg.Reactions
	sd.acknowledgements = msg.Acknowledgements
	sd.statuses = msg.Statuses
}

// syncForRemote updates a remote cluster with any new posts/reactions for a specific
// channel. If many changes are found, only the oldest X changes are sent and the channel
// is re-added to the task map. This ensures no channels are starved for updates even if some
// channels are very active.
// Returning an error forces a retry on the task.
func (scs *Service) syncForRemote(task syncTask, rc *model.RemoteCluster) error {
	// Empty channelID indicates a global user sync task
	// Normal syncTasks always include a valid channelID
	if task.channelID == "" {
		return scs.syncAllUsers(rc)
	}

	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot update remote cluster %s for channel id %s; Remote Cluster Service not enabled", rc.Name, task.channelID)
	}

	metrics := scs.server.GetMetrics()

	start := time.Now()
	var metricsRecorded bool
	defer func() {
		if !metricsRecorded && metrics != nil {
			metrics.IncrementSharedChannelsSyncCounter(rc.RemoteId)
			metrics.ObserveSharedChannelsSyncCollectionDuration(rc.RemoteId, time.Since(start).Seconds())
			metricsRecorded = true
		}
	}()

	scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(task.channelID, rc.RemoteId)
	if isNotFoundError(err) && rc.IsOptionFlagSet(model.BitflagOptionAutoInvited) {
		// if SharedChannelRemote not found and remote has autoinvite flag, create a scr for it, thus inviting the remote.
		scr = &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         task.channelID,
			CreatorId:         rc.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          rc.RemoteId,
			LastPostCreateAt:  model.GetMillis(),
			LastPostUpdateAt:  model.GetMillis(),
			LastMembersSyncAt: 0,
		}
		if scr, err = scs.server.GetStore().SharedChannel().SaveRemote(scr); err != nil {
			return fmt.Errorf("cannot auto-create shared channel remote (channel_id=%s, remote_id=%s): %w", task.channelID, rc.RemoteId, err)
		}
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Auto-invited remote to channel (BitflagOptionAutoInvited)",
			mlog.String("remote", rc.DisplayName),
			mlog.String("channel_id", task.channelID),
		)
	} else if err == nil && scr.DeleteAt != 0 {
		// if SharedChannelRemote is deleted, regardless of the autoinvite flag, do nothing
		return nil
	} else if err != nil {
		return err
	}

	sd := newSyncData(task, rc, scr)

	// if this is retrying a failed msg, just send it again.
	if task.retryMsg != nil {
		sd.setDataFromMsg(task.retryMsg)
		return scs.sendSyncData(sd)
	}

	// if this has an already existing msg, just send it right away
	if task.existingMsg != nil {
		sd.setDataFromMsg(task.existingMsg)
		return scs.sendSyncData(sd)
	}

	// if we don't have a channelID at this point, we cannot fetch new
	// data from the database
	if task.channelID == "" {
		return fmt.Errorf("task doesn't have prefetched data nor a channel ID set")
	}

	// schedule another sync if the repeat flag is set at some point.
	defer func(rpt *bool) {
		if *rpt {
			scs.addTask(newSyncTask(task.channelID, task.userID, task.remoteID, nil, nil))
		}
	}(&sd.resultRepeat)

	// fetch new posts or retry post.
	if err := scs.fetchPostsForSync(sd); err != nil {
		return fmt.Errorf("cannot fetch posts for sync %v: %w", sd, err)
	}

	if !rc.IsOnline() {
		if len(sd.posts) != 0 {
			scs.notifyRemoteOffline(sd.posts, rc)
		}
		sd.resultRepeat = false
		return nil
	}

	// fetch users that have updated their user profile or image.
	if err := scs.fetchUsersForSync(sd); err != nil {
		return fmt.Errorf("cannot fetch users for sync %v: %w", sd, err)
	}

	// fetch reactions for posts
	if err := scs.fetchReactionsForSync(sd); err != nil {
		return fmt.Errorf("cannot fetch reactions for sync %v: %w", sd, err)
	}

	// fetch acknowledgements for posts
	if err := scs.fetchAcknowledgementsForSync(sd); err != nil {
		return fmt.Errorf("cannot fetch acknowledgements for sync %v: %w", sd, err)
	}

	// fetch users associated with posts & reactions
	if err := scs.fetchPostUsersForSync(sd); err != nil {
		return fmt.Errorf("cannot fetch post users for sync %v: %w", sd, err)
	}

	// filter out any posts that don't need to be sent.
	scs.filterPostsForSync(sd)

	// fetch attachments for posts
	if err := scs.fetchPostAttachmentsForSync(sd); err != nil {
		return fmt.Errorf("cannot fetch post attachments for sync %v: %w", sd, err)
	}

	if sd.isEmpty() {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Not sending sync data; everything filtered out",
			mlog.String("remote", rc.DisplayName),
			mlog.String("channel_id", task.channelID),
			mlog.Bool("repeat", sd.resultRepeat),
		)
		if sd.isCursorChanged() {
			scs.updateCursorForRemote(sd.scr.Id, sd.rc, sd.resultNextCursor)
		}
		return nil
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Sending sync data",
		mlog.String("remote", rc.DisplayName),
		mlog.String("channel_id", task.channelID),
		mlog.Bool("repeat", sd.resultRepeat),
		mlog.Int("users", len(sd.users)),
		mlog.Int("images", len(sd.profileImages)),
		mlog.Int("posts", len(sd.posts)),
		mlog.Int("reactions", len(sd.reactions)),
		mlog.Int("acknowledgements", len(sd.acknowledgements)),
		mlog.Int("attachments", len(sd.attachments)),
	)

	if !metricsRecorded && metrics != nil {
		metrics.IncrementSharedChannelsSyncCounter(rc.RemoteId)
		metrics.ObserveSharedChannelsSyncCollectionDuration(rc.RemoteId, time.Since(start).Seconds())
		metricsRecorded = true
	}

	return scs.sendSyncData(sd)
}

// fetchUsersForSync populates the sync data with any channel users who updated their user profile
// since the last sync.
func (scs *Service) fetchUsersForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "Users", time.Since(start).Seconds())
		}
	}()

	filter := model.GetUsersForSyncFilter{
		ChannelID: sd.task.channelID,
		Limit:     MaxUsersPerSync,
	}
	users, err := scs.server.GetStore().SharedChannel().GetUsersForSync(filter)
	if err != nil {
		return err
	}

	// Don't sync users back to the remote cluster they originated from
	for _, u := range users {
		if u.GetRemoteID() != sd.rc.RemoteId {
			sd.users[u.Id] = u
		}
	}

	filter.CheckProfileImage = true
	usersImage, err := scs.server.GetStore().SharedChannel().GetUsersForSync(filter)
	if err != nil {
		return err
	}

	for _, u := range usersImage {
		if u.GetRemoteID() != sd.rc.RemoteId {
			sd.profileImages[u.Id] = u
		}
	}
	return nil
}

// fetchPostsForSync populates the sync data with any new or edited posts since the last sync.
func (scs *Service) fetchPostsForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "Posts", time.Since(start).Seconds())
		}
	}()

	options := model.GetPostsSinceForSyncOptions{
		ChannelId:                         sd.task.channelID,
		IncludeDeleted:                    true,
		SinceCreateAt:                     true,
		ExcludeChannelMetadataSystemPosts: true,
	}
	cursor := model.GetPostsSinceForSyncCursor{
		LastPostUpdateAt: sd.scr.LastPostUpdateAt,
		LastPostUpdateID: sd.scr.LastPostUpdateID,
		LastPostCreateAt: sd.scr.LastPostCreateAt,
		LastPostCreateID: sd.scr.LastPostCreateID,
	}
	maxPostsPerSync := *scs.server.Config().ConnectedWorkspacesSettings.MaxPostsPerSync

	// Fetch all newly created posts first. This is to ensure that post order is preserved for sync targets
	// that cannot set the CreateAt timestamp for incoming posts (e.g. MS Teams).  If we simply used UpdateAt
	// then posts could get out of order. For example: p1 created, p2 created, p1 updated... sync'ing on UpdateAt
	// would order the posts p2, p1.
	posts, nextCursor, err := scs.server.GetStore().Post().GetPostsSinceForSync(options, cursor, maxPostsPerSync)
	if err != nil {
		return fmt.Errorf("could not fetch new posts for sync: %w", err)
	}
	count := len(posts)
	sd.posts = appendPosts(sd.posts, posts, scs.server.GetStore().Post(), cursor.LastPostCreateAt, scs.server.Log())

	cache := postsSliceToMap(posts)

	// Fill remaining batch capacity with updated posts.
	if len(posts) < maxPostsPerSync {
		options.SinceCreateAt = false
		// use 'nextcursor' as it has the correct xxxUpdateAt values, and the updsted xxxCreateAt values.
		posts, nextCursor, err = scs.server.GetStore().Post().GetPostsSinceForSync(options, nextCursor, maxPostsPerSync-len(posts))
		if err != nil {
			return fmt.Errorf("could not fetch modified posts for sync: %w", err)
		}
		posts = reducePostsSliceInCache(posts, cache)
		count += len(posts)
		sd.posts = appendPosts(sd.posts, posts, scs.server.GetStore().Post(), cursor.LastPostUpdateAt, scs.server.Log())
	}

	// Populate metadata for all posts before syncing
	for i, post := range sd.posts {
		if post != nil {
			sd.posts[i] = scs.app.PreparePostForClient(request.EmptyContext(scs.server.Log()), post, &model.PreparePostForClientOpts{IncludePriority: true})
		}
	}

	sd.resultNextCursor = nextCursor
	sd.resultRepeat = count >= maxPostsPerSync

	return nil
}

func appendPosts(dest []*model.Post, posts []*model.Post, postStore store.PostStore, timestamp int64, logger mlog.LoggerIFace) []*model.Post {
	// Append the posts individually, checking for root posts that might appear later in the list.
	// This is due to the UpdateAt collision handling algorithm where the order of posts is not based
	// on UpdateAt or CreateAt when the posts have the same UpdateAt value. Here we are guarding
	// against a root post with the same UpdateAt (and probably the same CreateAt) appearing later
	// in the list and must be sync'd before the child post. This is an edge case that likely only
	// happens during load testing or bulk imports.
	for _, p := range posts {
		if p.RootId != "" {
			root, err := postStore.GetSingle(request.EmptyContext(logger), p.RootId, true)
			if err == nil {
				if (root.CreateAt >= timestamp || root.UpdateAt >= timestamp) && !containsPost(dest, root) {
					dest = append(dest, root)
				}
			}
		}
		dest = append(dest, p)
	}
	return dest
}

func containsPost(posts []*model.Post, post *model.Post) bool {
	for _, p := range posts {
		if p.Id == post.Id {
			return true
		}
	}
	return false
}

// fetchReactionsForSync populates the sync data with any new reactions since the last sync.
func (scs *Service) fetchReactionsForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "Reactions", time.Since(start).Seconds())
		}
	}()

	merr := merror.New()
	for _, post := range sd.posts {
		// any reactions originating from the remote cluster are filtered out
		reactions, err := scs.server.GetStore().Reaction().GetForPostSince(post.Id, sd.scr.LastPostUpdateAt, sd.rc.RemoteId, true)
		if err != nil {
			merr.Append(fmt.Errorf("could not get reactions for post %s: %w", post.Id, err))
			continue
		}
		sd.reactions = append(sd.reactions, reactions...)
	}
	return merr.ErrorOrNil()
}

// fetchAcknowledgementsForSync populates the sync data with any new acknowledgements since the last sync.
func (scs *Service) fetchAcknowledgementsForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "Acknowledgements", time.Since(start).Seconds())
		}
	}()

	merr := merror.New()
	for _, post := range sd.posts {
		// any acknowledgements originating from the remote cluster are filtered out
		acknowledgements, err := scs.server.GetStore().PostAcknowledgement().GetForPostSince(post.Id, sd.scr.LastPostUpdateAt, sd.rc.RemoteId, true)
		if err != nil {
			merr.Append(fmt.Errorf("could not get acknowledgements for post %s: %w", post.Id, err))
			continue
		}
		sd.acknowledgements = append(sd.acknowledgements, acknowledgements...)
	}
	return merr.ErrorOrNil()
}

// fetchPostUsersForSync populates the sync data with all users associated with posts.
func (scs *Service) fetchPostUsersForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "PostUsers", time.Since(start).Seconds())
		}
	}()

	sc, err := scs.server.GetStore().SharedChannel().Get(sd.task.channelID)
	if err != nil {
		return fmt.Errorf("cannot determine teamID: %w", err)
	}

	type p2mm struct {
		post       *model.Post
		mentionMap model.UserMentionMap
	}

	userIDs := make(map[string]p2mm)

	for _, reaction := range sd.reactions {
		userIDs[reaction.UserId] = p2mm{}
	}

	for _, acknowledgement := range sd.acknowledgements {
		userIDs[acknowledgement.UserId] = p2mm{}
	}

	for _, post := range sd.posts {
		// get mentions and users for each mention
		mentionMap := scs.app.MentionsToTeamMembers(request.EmptyContext(scs.server.Log()), post.Message, sc.TeamId)

		// Skip notifications for remote users unless mentioned with @username:remote format
		for mention, userID := range mentionMap {
			user, err := scs.server.GetStore().User().Get(context.Background(), userID)
			if err != nil {
				continue
			}

			// Skip remote users unless mention contains a colon (@username:remote)
			if user.IsRemote() && !strings.Contains(mention, ":") {
				continue
			}
		}

		// add author with post and mentionMap so transformations can be applied
		userIDs[post.UserId] = p2mm{
			post:       post,
			mentionMap: mentionMap,
		}

		// Add all mentioned users
		for _, userID := range mentionMap {
			userIDs[userID] = p2mm{
				post:       post,
				mentionMap: mentionMap,
			}
		}
	}

	merr := merror.New()
	for userID, v := range userIDs {
		user, err := scs.server.GetStore().User().Get(context.Background(), userID)
		if err != nil {
			merr.Append(fmt.Errorf("could not get user %s: %w", userID, err))
			continue
		}

		sync, syncImage, err2 := scs.shouldUserSync(user, sd.task.channelID, sd.rc)
		if err2 != nil {
			merr.Append(fmt.Errorf("could not check should sync user %s: %w", userID, err2))
			continue
		}

		if sync {
			sd.users[user.Id] = user
		}

		if syncImage {
			sd.profileImages[user.Id] = user
		}

		// Collect mention transforms for all mentioned users
		if v.mentionMap != nil {
			for mention, mentionUserID := range v.mentionMap {
				if mentionUserID == userID {
					// Always add the mention transform - let receiver decide how to display
					// The sender should NOT modify the message, only provide the mapping
					sd.mentionTransforms[mention] = userID
				}
			}
		}
	}
	return merr.ErrorOrNil()
}

// fetchPostAttachmentsForSync populates the sync data with any file attachments for new posts.
func (scs *Service) fetchPostAttachmentsForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "Attachments", time.Since(start).Seconds())
		}
	}()

	merr := merror.New()
	for _, post := range sd.posts {
		fis, err := scs.server.GetStore().FileInfo().GetForPost(post.Id, false, true, true)
		if err != nil {
			merr.Append(fmt.Errorf("could not get file attachment info for post %s: %w", post.Id, err))
			continue
		}

		for _, fi := range fis {
			if scs.shouldSyncAttachment(fi, sd.rc) {
				sd.attachments = append(sd.attachments, attachment{fi: fi, post: post})
			}
		}
	}
	return merr.ErrorOrNil()
}

// filterPostsForSync removes any posts that do not need to sync.
func (scs *Service) filterPostsForSync(sd *syncData) {
	filtered := make([]*model.Post, 0, len(sd.posts))

	for _, p := range sd.posts {
		// Don't resend an existing post where only the reactions changed.
		// Posts we must send:
		//   - new posts (EditAt == 0)
		//   - edited posts (EditAt >= LastPostUpdateAt)
		//   - deleted posts (DeleteAt > 0)
		//   - posts with metadata changes (acknowledgements/priority)
		hasMetadataChanges := p.Metadata != nil && (p.Metadata.Acknowledgements != nil || p.Metadata.Priority != nil)
		if p.EditAt > 0 && p.EditAt < sd.scr.LastPostUpdateAt && p.DeleteAt == 0 && !hasMetadataChanges {
			continue
		}

		// Don't send a deleted post if it is just the original copy from an edit.
		if p.DeleteAt > 0 && p.OriginalId != "" {
			continue
		}

		// don't sync a post back to the remote cluster it came from.
		if p.GetRemoteID() == sd.rc.RemoteId {
			continue
		}

		// parse out all permalinks in the message.
		p.Message = scs.processPermalinkToRemote(p)

		filtered = append(filtered, p)
	}

	sd.posts = filtered
}

// sendSyncData sends all the collected users, posts, reactions, images, and attachments to the
// remote cluster.
// The order of items sent is important: users -> attachments -> posts -> reactions -> profile images
func (scs *Service) sendSyncData(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncSendDuration(sd.rc.RemoteId, time.Since(start).Seconds())
		}
	}()

	merr := merror.New()
	sanitizeSyncData(sd)

	// send users
	if len(sd.users) != 0 {
		if err := scs.sendUserSyncData(sd); err != nil {
			merr.Append(fmt.Errorf("cannot send user sync data: %w", err))
		}
	}

	// send attachments
	if len(sd.attachments) != 0 {
		scs.sendAttachmentSyncData(sd)
	}

	// send posts
	if len(sd.posts) != 0 {
		if err := scs.sendPostSyncData(sd); err != nil {
			merr.Append(fmt.Errorf("cannot send post sync data: %w", err))
		}
	} else if sd.isCursorChanged() {
		scs.updateCursorForRemote(sd.scr.Id, sd.rc, sd.resultNextCursor)
	}

	// send acknowledgements
	if len(sd.acknowledgements) != 0 {
		if err := scs.sendAcknowledgementSyncData(sd); err != nil {
			merr.Append(fmt.Errorf("cannot send acknowledgement sync data: %w", err))
		}
	}

	// send reactions
	if len(sd.reactions) != 0 {
		if err := scs.sendReactionSyncData(sd); err != nil {
			merr.Append(fmt.Errorf("cannot send reaction sync data: %w", err))
		}
	}

	// send statuses
	if len(sd.statuses) != 0 {
		if err := scs.sendStatusSyncData(sd); err != nil {
			merr.Append(fmt.Errorf("cannot send status sync data: %w", err))
		}
	}

	// send user profile images
	if len(sd.profileImages) != 0 {
		scs.sendProfileImageSyncData(sd)
	}

	return merr.ErrorOrNil()
}

// sendUserSyncData sends the collected user updates to the remote cluster.
func (scs *Service) sendUserSyncData(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncSendStepDuration(sd.rc.RemoteId, "Users", time.Since(start).Seconds())
		}
	}()

	msg := model.NewSyncMsg(sd.task.channelID)
	msg.Users = sd.users

	err := scs.sendSyncMsgToRemote(msg, sd.rc, func(syncResp model.SyncResponse, errResp error) {
		// Only update cursor on successful sync
		if errResp == nil && sd.GlobalUserSyncLastTimestamp > 0 {
			scs.updateGlobalSyncCursor(sd.rc, sd.GlobalUserSyncLastTimestamp)
		}

		for _, userID := range syncResp.UsersSyncd {
			if err := scs.server.GetStore().SharedChannel().UpdateUserLastSyncAt(userID, sd.task.channelID, sd.rc.RemoteId); err != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Cannot update shared channel user LastSyncAt",
					mlog.String("user_id", userID),
					mlog.String("channel_id", sd.task.channelID),
					mlog.String("remote_id", sd.rc.RemoteId),
					mlog.Err(err),
				)
			}
		}
		if len(syncResp.UserErrors) != 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Response indicates error for user(s) sync",
				mlog.String("channel_id", sd.task.channelID),
				mlog.String("remote_id", sd.rc.RemoteId),
				mlog.Array("users", syncResp.UserErrors),
			)
		}
	})
	return err
}

// sendAttachmentSyncData sends the collected post updates to the remote cluster.
func (scs *Service) sendAttachmentSyncData(sd *syncData) {
	for _, a := range sd.attachments {
		if err := scs.sendAttachmentForRemote(a.fi, a.post, sd.rc); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Cannot sync post attachment",
				mlog.String("post_id", a.post.Id),
				mlog.String("channel_id", sd.task.channelID),
				mlog.String("remote_id", sd.rc.RemoteId),
				mlog.Err(err),
			)
		}
		// updating SharedChannelAttachments with LastSyncAt is already done.
	}
}

// sendPostSyncData sends the collected post updates to the remote cluster.
func (scs *Service) sendPostSyncData(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncSendStepDuration(sd.rc.RemoteId, "Posts", time.Since(start).Seconds())
		}
	}()

	msg := model.NewSyncMsg(sd.task.channelID)
	msg.Posts = sd.posts
	msg.MentionTransforms = sd.mentionTransforms

	return scs.sendSyncMsgToRemote(msg, sd.rc, func(syncResp model.SyncResponse, errResp error) {
		if len(syncResp.PostErrors) != 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Response indicates error for post(s) sync",
				mlog.String("channel_id", sd.task.channelID),
				mlog.String("remote_id", sd.rc.RemoteId),
				mlog.Array("posts", syncResp.PostErrors),
			)

			for _, postID := range syncResp.PostErrors {
				scs.handlePostError(postID, sd.task, sd.rc)
			}
		}
		scs.updateCursorForRemote(sd.scr.Id, sd.rc, sd.resultNextCursor)
	})
}

// sendReactionSyncData sends the collected reaction updates to the remote cluster.
func (scs *Service) sendReactionSyncData(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncSendStepDuration(sd.rc.RemoteId, "Reactions", time.Since(start).Seconds())
		}
	}()

	msg := model.NewSyncMsg(sd.task.channelID)
	msg.Reactions = sd.reactions

	return scs.sendSyncMsgToRemote(msg, sd.rc, func(syncResp model.SyncResponse, errResp error) {
		if len(syncResp.ReactionErrors) != 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Response indicates error for reactions(s) sync",
				mlog.String("channel_id", sd.task.channelID),
				mlog.String("remote_id", sd.rc.RemoteId),
				mlog.Array("reaction_posts", syncResp.ReactionErrors),
			)
		}
	})
}

// sendAcknowledgementSyncData sends the collected acknowledgement updates to the remote cluster.
func (scs *Service) sendAcknowledgementSyncData(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncSendStepDuration(sd.rc.RemoteId, "Acknowledgements", time.Since(start).Seconds())
		}
	}()

	msg := model.NewSyncMsg(sd.task.channelID)
	msg.Acknowledgements = sd.acknowledgements

	return scs.sendSyncMsgToRemote(msg, sd.rc, func(syncResp model.SyncResponse, errResp error) {
		if len(syncResp.AcknowledgementErrors) != 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Response indicates error for acknowledgement(s) sync",
				mlog.String("channel_id", sd.task.channelID),
				mlog.String("remote_id", sd.rc.RemoteId),
				mlog.Array("acknowledgement_posts", syncResp.AcknowledgementErrors),
			)
		}
	})
}

// sendStatusSyncData sends the collected status updates to the remote cluster.
func (scs *Service) sendStatusSyncData(sd *syncData) error {
	msg := model.NewSyncMsg(sd.task.channelID)
	msg.Statuses = sd.statuses

	return scs.sendSyncMsgToRemote(msg, sd.rc, func(syncResp model.SyncResponse, errResp error) {
		if len(syncResp.StatusErrors) != 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Response indicates error from status(es) sync",
				mlog.String("remote_id", sd.rc.RemoteId),
				mlog.Array("user_ids", syncResp.StatusErrors),
			)

			for _, userID := range syncResp.StatusErrors {
				scs.handleStatusError(userID, sd.task, sd.rc)
			}
		}
	})
}

// sendProfileImageSyncData sends the collected user profile image updates to the remote cluster.
func (scs *Service) sendProfileImageSyncData(sd *syncData) {
	for _, user := range sd.profileImages {
		scs.syncProfileImage(user, sd.task.channelID, sd.rc)
	}
}

// shouldUserSyncGlobal determines if a user needs to be synchronized globally.
// Compares user's update timestamp with the remote cluster's LastGlobalUserSyncAt.
func (scs *Service) shouldUserSyncGlobal(user *model.User, rc *model.RemoteCluster) (bool, error) {
	// Don't sync users back to the remote cluster they originated from
	if user.IsRemote() && user.GetRemoteID() == rc.RemoteId {
		return false, nil
	}

	// Calculate latest update time for this user (profile or picture)
	latestUserUpdateTime := max(user.LastPictureUpdate, user.UpdateAt)

	// For initial sync (LastGlobalUserSyncAt=0), sync all users
	// For incremental sync, only sync users updated after the last sync
	if rc.LastGlobalUserSyncAt == 0 {
		return true, nil
	}
	return latestUserUpdateTime > rc.LastGlobalUserSyncAt, nil
}

// syncAllUsers synchronizes all local users to a remote cluster.
// This is called when a connection with a remote cluster is established or when handling a global user sync task.
// Uses cursor-based approach with LastGlobalUserSyncAt to resume after interruptions.
func (scs *Service) syncAllUsers(rc *model.RemoteCluster) error {
	// Check if feature is enabled
	if !scs.server.Config().FeatureFlags.EnableSyncAllUsersForRemoteCluster {
		return nil
	}

	if !rc.IsOnline() {
		return fmt.Errorf("remote cluster %s is not online", rc.RemoteId)
	}

	// Start metrics tracking
	metrics := scs.server.GetMetrics()
	start := time.Now()
	defer func() {
		if metrics != nil {
			metrics.IncrementSharedChannelsSyncCounter(rc.RemoteId)
			metrics.ObserveSharedChannelsSyncCollectionDuration(rc.RemoteId, time.Since(start).Seconds())
		}
	}()

	batchSize := scs.getGlobalUserSyncBatchSize()

	// Create sync data with collected users
	sd := &syncData{
		task:  syncTask{remoteID: rc.RemoteId},
		rc:    rc,
		scr:   &model.SharedChannelRemote{RemoteId: rc.RemoteId},
		users: make(map[string]*model.User),
	}

	// Collect users to sync
	users, latestTimestamp, _, hasMore, err := scs.collectUsersForGlobalSync(rc, batchSize)
	if err != nil {
		return err
	}

	// Exit early if no users to sync
	if len(users) == 0 {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "No users to sync for remote cluster",
			mlog.String("remote_id", rc.RemoteId))
		return nil
	}

	// Add users to sync data
	sd.users = users
	sd.GlobalUserSyncLastTimestamp = latestTimestamp

	// Send the collected users to remote
	if err := scs.sendUserSyncData(sd); err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error sending user batch during sync",
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(err),
		)
		return fmt.Errorf("error sending user batch during sync: %w", err)
	}

	// Schedule next batch if needed
	if hasMore {
		scs.scheduleNextUserSyncBatch(rc, latestTimestamp, batchSize, len(users))
	}

	return nil
}

// getGlobalUserSyncBatchSize returns the configured batch size for user syncing
func (scs *Service) getGlobalUserSyncBatchSize() int {
	batchSize := MaxUsersPerSync
	if scs.server.Config().ConnectedWorkspacesSettings.GlobalUserSyncBatchSize != nil {
		configValue := *scs.server.Config().ConnectedWorkspacesSettings.GlobalUserSyncBatchSize
		if configValue > 0 && configValue <= 200 {
			batchSize = configValue
		}
	}
	return batchSize
}

// collectUsersForGlobalSync fetches users that need to be synced to the remote
func (scs *Service) collectUsersForGlobalSync(rc *model.RemoteCluster, batchSize int) (map[string]*model.User, int64, int, bool, error) {
	options := &model.UserGetOptions{
		Page:    0,
		PerPage: 100, // Database fetch batch size
		Active:  true,
		Sort:    "update_at_asc", // Order by UpdateAt ASC to ensure cursor consistency
	}

	// Only use UpdatedAfter for incremental syncs, not the initial sync
	// This ensures users with UpdateAt=0 are included in the first sync
	if rc.LastGlobalUserSyncAt > 0 {
		options.UpdatedAfter = rc.LastGlobalUserSyncAt
	}

	users := make(map[string]*model.User)
	latestTimestamp := rc.LastGlobalUserSyncAt
	totalCount := 0

	// Page through database results
	for {
		batch, err := scs.server.GetStore().User().GetAllProfiles(options)
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error fetching users for global sync",
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(err),
			)
			return nil, 0, 0, false, err
		}

		if len(batch) == 0 {
			break // No more users to process
		}

		totalCount += len(batch)

		// Process each user in this database page
		for _, user := range batch {
			// Stop if we've reached batch limit
			if len(users) >= batchSize {
				return users, latestTimestamp, totalCount, true, nil
			}

			// Skip users from remotes
			if user.IsRemote() {
				continue
			}

			// Check if user needs syncing
			needsSync, _ := scs.shouldUserSyncGlobal(user, rc)
			if !needsSync {
				continue
			}

			// Add user and update cursor timestamp
			users[user.Id] = user

			userUpdateTime := max(user.UpdateAt, user.LastPictureUpdate)
			if userUpdateTime > latestTimestamp {
				latestTimestamp = userUpdateTime
			}
		}

		// Check if we've reached the end of results
		if len(batch) < options.PerPage {
			break
		}

		// Move to next page
		options.Page++
	}

	return users, latestTimestamp, totalCount, false, nil
}

// updateGlobalSyncCursor updates the LastGlobalUserSyncAt value for the remote cluster
func (scs *Service) updateGlobalSyncCursor(rc *model.RemoteCluster, newTimestamp int64) {
	if err := scs.server.GetStore().RemoteCluster().UpdateLastGlobalUserSyncAt(rc.RemoteId, newTimestamp); err == nil {
		rc.LastGlobalUserSyncAt = newTimestamp
	} else {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update global user sync cursor",
			mlog.String("remote_id", rc.RemoteId),
			mlog.Err(err),
		)
	}
}

// scheduleNextUserSyncBatch creates a new task for the next batch of user sync
func (scs *Service) scheduleNextUserSyncBatch(rc *model.RemoteCluster, timestamp int64, batchSize, processedCount int) {
	// Use timestamp as userID to make each batch task unique
	// This prevents task ID collisions between different batches for the same remote
	timestampStr := fmt.Sprintf("%d", timestamp)
	task := newSyncTask("", timestampStr, rc.RemoteId, nil, nil)
	task.schedule = time.Now().Add(NotifyMinimumDelay)
	scs.addTask(task)
}

// sendSyncMsgToRemote synchronously sends the sync message to the remote cluster (or plugin).
func (scs *Service) sendSyncMsgToRemote(msg *model.SyncMsg, rc *model.RemoteCluster, f sendSyncMsgResultFunc) error {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot update remote cluster %s for channel id %s; Remote Cluster Service not enabled", rc.Name, msg.ChannelId)
	}

	if rc.IsPlugin() {
		return scs.sendSyncMsgToPlugin(msg, rc, f)
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	// Use appropriate topic based on message type
	topic := TopicSync
	if msg.ChannelId == "" && len(msg.Users) > 0 &&
		len(msg.Posts) == 0 && len(msg.Reactions) == 0 &&
		len(msg.Statuses) == 0 {
		topic = TopicGlobalUserSync
	}
	rcMsg := model.NewRemoteClusterMsg(topic, b)

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)

	err = rcs.SendMsg(ctx, rcMsg, rc, func(rcMsg model.RemoteClusterMsg, rc *model.RemoteCluster, rcResp *remotecluster.Response, errResp error) {
		defer wg.Done()

		// Check for ErrChannelNotShared in the application response
		if rcResp != nil && !rcResp.IsSuccess() && strings.Contains(rcResp.Err, ErrChannelNotShared.Error()) {
			scs.handleChannelNotSharedError(msg, rc)
			return
		}

		var syncResp model.SyncResponse
		if errResp == nil {
			if rcResp != nil && len(rcResp.Payload) > 0 {
				if err2 := json.Unmarshal(rcResp.Payload, &syncResp); err2 != nil {
					scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Invalid sync msg response from remote cluster",
						mlog.String("remote", rc.Name),
						mlog.String("channel_id", msg.ChannelId),
						mlog.Err(err2),
					)
					return
				}

				if f != nil {
					f(syncResp, errResp)
				}
			} else {
				// No error but response is nil or empty
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Empty or nil response payload from remote cluster",
					mlog.String("remote", rc.Name),
					mlog.String("channel_id", msg.ChannelId),
				)
			}
		}
	})

	wg.Wait()
	return err
}

// sendSyncMsgToRemote synchronously sends the sync message to a plugin.
func (scs *Service) sendSyncMsgToPlugin(msg *model.SyncMsg, rc *model.RemoteCluster, f sendSyncMsgResultFunc) error {
	syncResp, errResp := scs.app.OnSharedChannelsSyncMsg(msg, rc)

	if f != nil {
		f(syncResp, errResp)
	}

	return errResp
}

func sanitizeSyncData(sd *syncData) {
	for id, user := range sd.users {
		sd.users[id] = sanitizeUserForSync(user)
	}
	for id, user := range sd.profileImages {
		sd.profileImages[id] = sanitizeUserForSync(user)
	}
}

// handleChannelNotSharedError processes the case when a remote indicates a channel
// is no longer shared. It removes the remote from the shared channel locally and,
// if it was the last remote, completely unshares the channel.
func (scs *Service) handleChannelNotSharedError(msg *model.SyncMsg, rc *model.RemoteCluster) {
	logger := scs.server.Log()

	logger.Log(mlog.LvlSharedChannelServiceDebug, "Remote indicated channel is no longer shared; unsharing locally",
		mlog.String("remote", rc.Name),
		mlog.String("channel_id", msg.ChannelId),
	)

	// Get the SharedChannelRemote record for this channel and remote
	scr, getErr := scs.server.GetStore().SharedChannel().GetRemoteByIds(msg.ChannelId, rc.RemoteId)
	if getErr != nil {
		logger.Log(mlog.LvlSharedChannelServiceError, "Failed to get shared channel remote",
			mlog.String("remote", rc.Name),
			mlog.String("channel_id", msg.ChannelId),
			mlog.Err(getErr),
		)
		return
	}

	// Get channel details for posting the system message
	channel, channelErr := scs.server.GetStore().Channel().Get(msg.ChannelId, true)
	if channelErr != nil {
		logger.Log(mlog.LvlSharedChannelServiceError, "Failed to get channel details",
			mlog.String("remote", rc.Name),
			mlog.String("channel_id", msg.ChannelId),
			mlog.Err(channelErr),
		)
		return
	}

	// Post a system message to notify users that the channel is no longer shared with this remote
	scs.postUnshareNotification(msg.ChannelId, scr.CreatorId, channel, rc)

	if err := scs.UninviteRemoteFromChannel(msg.ChannelId, rc.RemoteId); err != nil {
		logger.Log(mlog.LvlSharedChannelServiceError, "Failed to uninvite remote from shared channel", mlog.Err(err))
		return
	}
}
