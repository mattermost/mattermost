// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

// accessControlResourceDecisions memoizes allow decisions for one request,
// keyed by prop value, so a page of posts from the same thread costs one
// evaluation.
type accessControlResourceDecisions map[string]bool

// AccessControlResourceAllowed reports whether userID may read a post that
// carries props.access_control_resource = value. A malformed value, an
// evaluation error, or a policy that exists but cannot be evaluated all deny.
func (a *App) AccessControlResourceAllowed(rctx request.CTX, userID, value string) bool {
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
	if postList == nil || len(postList.Posts) == 0 || userID == "" {
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

// filterThreadsByAccessControlResource drops threads whose root denies userID.
func (a *App) filterThreadsByAccessControlResource(rctx request.CTX, userID string, threads []*model.ThreadResponse) []*model.ThreadResponse {
	if len(threads) == 0 || userID == "" {
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

// accessControlResourceDeniedError is the 403 returned when a user acts on a
// post whose access_control_resource denies them.
func accessControlResourceDeniedError(where string) *model.AppError {
	return model.NewAppError(where, "api.post.access_control_resource.denied.app_error", nil, "", http.StatusForbidden)
}
