// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"maps"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// Posts marked with props.access_control_resource are governed by a
// plugin-owned access control policy. Two evaluation lanes serve them:
//
//   - Read paths ("this user, these posts") evaluate through the engine's
//     compiled policies, which is exact: see filterPostsByAccessControlResource
//     and AccessControlResourceAllowed.
//   - Delivery paths ("this post, every connected user or candidate
//     recipient") read a per-node recipient set filled by one
//     QueryUsersForResource: see accessControlRecipientCache. The set is dropped
//     cluster-wide when the policy is saved or deleted and expires on its own
//     so attribute drift is bounded; when a fill fails, delivery falls back to
//     the read lane per user.
//
// A marked post whose policy does not exist is readable by everyone (core's
// no-policy contract), so plugins can mark every post from day one. Any
// evaluation failure denies.

// postAccessControlResourceEnabled reports whether the PostAccessControlResource
// feature flag is on. With it off, the marker is treated like any reserved
// prop and nothing below enforces it.
func (a *App) postAccessControlResourceEnabled() bool {
	return a.Config().FeatureFlags.PostAccessControlResource
}

// accessControlResourceDecisions memoizes allow decisions for one request,
// keyed by prop value, so a page of posts from the same thread costs one
// evaluation.
type accessControlResourceDecisions map[string]bool

// AccessControlResourceAllowed reports whether userID may read a post that
// carries props.access_control_resource = value. A malformed value, an
// evaluation error, or a policy that exists but cannot be evaluated all deny.
func (a *App) AccessControlResourceAllowed(rctx request.CTX, userID, value string) bool {
	if !a.postAccessControlResourceEnabled() {
		return true
	}
	return a.accessControlResourceDecisionsFor(rctx, userID, []string{value})[value]
}

// postAllowedByAccessControlResource reports whether userID may read post. An
// unmarked post is always allowed here; channel permissions are the caller's.
func (a *App) postAllowedByAccessControlResource(rctx request.CTX, userID string, post *model.Post) bool {
	value := post.GetAccessControlResource()
	if value == "" {
		return true
	}
	return a.AccessControlResourceAllowed(rctx, userID, value)
}

// accessControlResourceDecisionsFor evaluates each distinct prop value for
// userID, grouping by policy type and action so the subject is built once per
// group. Values missing from the engine's answer are denied.
func (a *App) accessControlResourceDecisionsFor(rctx request.CTX, userID string, values []string) accessControlResourceDecisions {
	decisions := make(accessControlResourceDecisions, len(values))
	if userID == "" {
		for _, v := range values {
			decisions[v] = false
		}
		return decisions
	}

	type group struct {
		pluginID   string
		policyType string
		action     string
	}
	groups := map[group][]string{}
	byResource := map[group]map[string][]string{}
	for _, value := range values {
		if _, seen := decisions[value]; seen {
			continue
		}
		decisions[value] = false
		parsed, err := model.ParsePostAccessControlResource(value)
		if err != nil {
			rctx.Logger().Debug("Post carries a malformed access_control_resource; denying", mlog.String("value", value), mlog.Err(err))
			continue
		}
		g := group{pluginID: parsed.PluginID, policyType: parsed.PolicyType, action: parsed.Action}
		if byResource[g] == nil {
			byResource[g] = map[string][]string{}
		}
		if _, seen := byResource[g][parsed.ResourceID]; !seen {
			groups[g] = append(groups[g], parsed.ResourceID)
		}
		byResource[g][parsed.ResourceID] = append(byResource[g][parsed.ResourceID], value)
	}

	for g, resourceIDs := range groups {
		for start := 0; start < len(resourceIDs); start += pluginAccessControlBatchMax {
			end := min(start+pluginAccessControlBatchMax, len(resourceIDs))
			results, appErr := a.EvaluatePluginAccessRequestBatch(rctx, g.pluginID, userID, g.policyType, g.action, resourceIDs[start:end])
			if appErr != nil {
				rctx.Logger().Warn("Access control resource evaluation failed; denying the batch",
					mlog.String("user_id", userID), mlog.String("policy_type", g.policyType), mlog.String("action", g.action), mlog.Err(appErr))
				continue
			}
			for _, resourceID := range resourceIDs[start:end] {
				decision, ok := results[resourceID]
				allowed := ok && decision != nil && decision.Decision
				for _, value := range byResource[g][resourceID] {
					decisions[value] = allowed
				}
			}
		}
	}
	return decisions
}

// filterPostsByAccessControlResource removes from postList every post whose
// access_control_resource denies userID. Posts and Order are both pruned, as
// are the thread participants of removed threads. An empty userID (a server
// or plugin caller with no acting user) leaves the list untouched.
func (a *App) filterPostsByAccessControlResource(rctx request.CTX, userID string, postList *model.PostList) {
	if postList == nil || len(postList.Posts) == 0 || userID == "" || !a.postAccessControlResourceEnabled() {
		return
	}

	var values []string
	for _, post := range postList.Posts {
		if value := post.GetAccessControlResource(); value != "" {
			values = append(values, value)
		}
	}
	if len(values) == 0 {
		return
	}

	decisions := a.accessControlResourceDecisionsFor(rctx, userID, values)
	removed := 0
	for id, post := range postList.Posts {
		value := post.GetAccessControlResource()
		if value == "" || decisions[value] {
			continue
		}
		delete(postList.Posts, id)
		removed++
	}
	if removed == 0 {
		return
	}

	order := postList.Order[:0]
	for _, id := range postList.Order {
		if _, ok := postList.Posts[id]; ok {
			order = append(order, id)
		}
	}
	postList.Order = order
}

// filterPostSliceByAccessControlResource is filterPostsByAccessControlResource
// for a plain slice of posts.
func (a *App) filterPostSliceByAccessControlResource(rctx request.CTX, userID string, posts []*model.Post) []*model.Post {
	if len(posts) == 0 || userID == "" || !a.postAccessControlResourceEnabled() {
		return posts
	}
	var values []string
	for _, post := range posts {
		if value := post.GetAccessControlResource(); value != "" {
			values = append(values, value)
		}
	}
	if len(values) == 0 {
		return posts
	}
	decisions := a.accessControlResourceDecisionsFor(rctx, userID, values)
	kept := posts[:0]
	for _, post := range posts {
		if value := post.GetAccessControlResource(); value == "" || decisions[value] {
			kept = append(kept, post)
		}
	}
	return kept
}

// FileInfoAllowedByAccessControlResource reports whether userID may read the
// post a file is attached to. A file without a post, or whose post is gone, is
// allowed here; channel permissions are the caller's. A failure to load the
// post denies.
func (a *App) FileInfoAllowedByAccessControlResource(rctx request.CTX, userID string, info *model.FileInfo) bool {
	if info == nil || info.PostId == "" || !a.postAccessControlResourceEnabled() {
		return true
	}
	post, err := a.Srv().Store().Post().GetSingle(rctx, info.PostId, true)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return true
		}
		rctx.Logger().Warn("Failed to load the post of a file to check its access control; denying", mlog.String("file_id", info.Id), mlog.String("post_id", info.PostId), mlog.Err(err))
		return false
	}
	return a.postAllowedByAccessControlResource(rctx, userID, post)
}

// filterFilesByAccessControlResource removes from fileList every file attached
// to a post whose access_control_resource denies userID. A failure to load the
// posts is returned so the caller denies the whole list.
func (a *App) filterFilesByAccessControlResource(rctx request.CTX, userID string, fileList *model.FileInfoList) error {
	if fileList == nil || len(fileList.FileInfos) == 0 || userID == "" || !a.postAccessControlResourceEnabled() {
		return nil
	}

	postIDs := map[string]struct{}{}
	for _, info := range fileList.FileInfos {
		if info.PostId != "" {
			postIDs[info.PostId] = struct{}{}
		}
	}
	if len(postIDs) == 0 {
		return nil
	}

	posts, err := a.Srv().Store().Post().GetPostsByIds(slices.Collect(maps.Keys(postIDs)))
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil
		}
		return err
	}

	markers := make(map[string]string, len(posts))
	var values []string
	for _, post := range posts {
		if value := post.GetAccessControlResource(); value != "" {
			markers[post.Id] = value
			values = append(values, value)
		}
	}
	if len(values) == 0 {
		return nil
	}

	decisions := a.accessControlResourceDecisionsFor(rctx, userID, values)
	denied := func(info *model.FileInfo) bool {
		value, marked := markers[info.PostId]
		return marked && !decisions[value]
	}

	kept := make(map[string]*model.FileInfo, len(fileList.FileInfos))
	for id, info := range fileList.FileInfos {
		if !denied(info) {
			kept[id] = info
		}
	}
	if len(kept) == len(fileList.FileInfos) {
		return nil
	}

	order := fileList.Order[:0]
	for _, id := range fileList.Order {
		if _, ok := kept[id]; ok {
			order = append(order, id)
		}
	}
	fileList.FileInfos = kept
	fileList.Order = order
	return nil
}

// filterThreadsByAccessControlResource drops threads whose root denies userID.
func (a *App) filterThreadsByAccessControlResource(rctx request.CTX, userID string, threads []*model.ThreadResponse) []*model.ThreadResponse {
	if len(threads) == 0 || userID == "" || !a.postAccessControlResourceEnabled() {
		return threads
	}
	var values []string
	for _, thread := range threads {
		if value := thread.Post.GetAccessControlResource(); value != "" {
			values = append(values, value)
		}
	}
	if len(values) == 0 {
		return threads
	}
	decisions := a.accessControlResourceDecisionsFor(rctx, userID, values)
	kept := threads[:0]
	for _, thread := range threads {
		if value := thread.Post.GetAccessControlResource(); value == "" || decisions[value] {
			kept = append(kept, thread)
		}
	}
	return kept
}

// deniedThreadAccessControlResources returns the access_control_resource values
// on the root posts of the threads userID follows that deny userID. Thread
// totals and pages leave those threads out, so the counts match what the user
// can open.
func (a *App) deniedThreadAccessControlResources(rctx request.CTX, userID, teamID string, options model.GetUserThreadsOpts) ([]string, error) {
	if userID == "" || !a.postAccessControlResourceEnabled() {
		return nil, nil
	}
	values, err := a.Srv().Store().Thread().GetThreadAccessControlResources(userID, teamID, options)
	if err != nil {
		return nil, err
	}
	if len(values) == 0 {
		return nil, nil
	}
	decisions := a.accessControlResourceDecisionsFor(rctx, userID, values)
	var denied []string
	for _, value := range values {
		if !decisions[value] {
			denied = append(denied, value)
		}
	}
	return denied, nil
}

// accessControlResourceDeniedError is the 403 returned when a user acts on a
// post whose access_control_resource denies them.
func accessControlResourceDeniedError(where string) error {
	return model.NewAppError(where, "api.post.access_control_resource.denied.app_error", nil, "", http.StatusForbidden)
}
