// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// hydratePostValues batch-loads the channel-post property values for the
// given posts and returns a slice of PostWithValues wrappers in the same
// order. Posts that carry no property values come back with a nil Values
// map. A single store call is used regardless of how many posts are passed.
//
// Used by filterPostsByPostPolicy. Never returned to clients.
func (a *App) hydratePostValues(rctx request.CTX, posts []*model.Post) ([]*model.PostWithValues, *model.AppError) {
	out := make([]*model.PostWithValues, 0, len(posts))
	if len(posts) == 0 {
		return out, nil
	}

	group, appErr := a.GetPropertyGroup(rctx, model.ChannelPostPropertyGroupName)
	if appErr != nil {
		// Group not registered yet → no values to hydrate. Don't fail the read.
		rctx.Logger().Warn("channel-post property group not registered; skipping post-policy hydration",
			mlog.Err(appErr))
		for _, p := range posts {
			out = append(out, &model.PostWithValues{Post: p})
		}
		return out, nil
	}

	postIDs := make([]string, 0, len(posts))
	for _, p := range posts {
		postIDs = append(postIDs, p.Id)
	}

	// SearchPropertyValues rejects PerPage<1, so page through results. A page
	// big enough to hold every value referenced by a single post-fetch page
	// (200 posts × a handful of fields each) keeps the loop to ~1 round trip
	// in practice while still respecting the store contract.
	const pageSize = 500
	var values []*model.PropertyValue
	cursor := model.PropertyValueSearchCursor{}
	for {
		page, appErr := a.SearchPropertyValues(rctx, group.ID, model.PropertyValueSearchOpts{
			GroupID:    group.ID,
			TargetType: model.PropertyValueTargetTypePost,
			TargetIDs:  postIDs,
			PerPage:    pageSize,
			Cursor:     cursor,
		})
		if appErr != nil {
			return nil, appErr
		}
		values = append(values, page...)
		if len(page) < pageSize {
			break
		}
		last := page[len(page)-1]
		cursor = model.PropertyValueSearchCursor{PropertyValueID: last.ID, CreateAt: last.CreateAt}
	}

	// Lookup table: field ID → field name. One paged sweep over the group.
	fieldNameByID := make(map[string]string)
	fieldCursor := model.PropertyFieldSearchCursor{}
	for {
		fields, appErr := a.SearchPropertyFields(rctx, group.ID, model.PropertyFieldSearchOpts{
			GroupID: group.ID,
			PerPage: pageSize,
			Cursor:  fieldCursor,
		})
		if appErr != nil {
			return nil, appErr
		}
		for _, f := range fields {
			fieldNameByID[f.ID] = f.Name
		}
		if len(fields) < pageSize {
			break
		}
		last := fields[len(fields)-1]
		fieldCursor = model.PropertyFieldSearchCursor{PropertyFieldID: last.ID, CreateAt: last.CreateAt}
	}
	// Pivot values into post-keyed maps of {field name → decoded value}.
	byPostID := make(map[string]map[string]any, len(posts))
	for _, v := range values {
		name, ok := fieldNameByID[v.FieldID]
		if !ok {
			continue
		}
		var decoded any
		if err := json.Unmarshal(v.Value, &decoded); err != nil {
			// Skip malformed values rather than failing the whole fetch.
			rctx.Logger().Warn("failed to decode property value for post policy",
				mlog.String("post_id", v.TargetID),
				mlog.String("field_id", v.FieldID),
				mlog.Err(err))
			continue
		}
		bucket, exists := byPostID[v.TargetID]
		if !exists {
			bucket = make(map[string]any)
			byPostID[v.TargetID] = bucket
		}
		bucket[name] = decoded
	}

	for _, p := range posts {
		out = append(out, &model.PostWithValues{Post: p, Values: byPostID[p.Id]})
	}
	return out, nil
}

// blankedPostFor returns a clone of the given post with user-visible content
// cleared and the PostPropsHiddenByPolicy sentinel set. The clone is critical:
// PostStore caches *model.Post pointers in memory (see
// LocalCachePostStore.GetPosts), so mutating the original would poison the
// cache for every subsequent reader (admins included). Timeline-essential
// fields (Id, UserId, ChannelId, CreateAt, Type) are preserved by Clone.
func blankedPostFor(p *model.Post) *model.Post {
	if p == nil {
		return nil
	}
	c := p.Clone()
	c.Message = ""
	c.FileIds = nil
	c.DelProp(model.PostPropsAttachments)
	if c.Props == nil {
		c.Props = model.StringInterface{}
	} else {
		// Clone's ShallowCopy copies the Props map header — make our own so
		// the sentinel doesn't leak back into the cached original.
		copied := make(model.StringInterface, len(c.Props)+1)
		for k, v := range c.Props {
			copied[k] = v
		}
		c.Props = copied
	}
	c.Props[model.PostPropsHiddenByPolicy] = true
	return c
}

// filterPostsByPostPolicy evaluates all post_filter rules on each post's
// channel policy for the given user. Posts denied by any applicable rule
// are blanked in place via blankPostInPlace; the PostList itself (order,
// next/prev pointers, count) is left untouched so the timeline stays
// consistent.
//
// No-op when:
//   - PostPolicy feature flag is off
//   - The enterprise access-control service isn't loaded
//   - The post list is empty
//
// Errors from the evaluator are fail-closed: the post is blanked. Errors
// from value hydration return as AppError so the caller can decide
// whether to abort the fetch.
func (a *App) filterPostsByPostPolicy(rctx request.CTX, postList *model.PostList, userID string) (*model.PostList, *model.AppError) {
	if postList == nil || len(postList.Posts) == 0 {
		return postList, nil
	}
	if !a.Config().FeatureFlags.PostPolicy {
		return postList, nil
	}
	ac := a.Srv().Channels().AccessControl
	if ac == nil {
		return postList, nil
	}

	subject, appErr := a.BuildAccessControlSubject(rctx, userID, "")
	if appErr != nil {
		return nil, appErr
	}

	// Materialize posts in stable order so hydration's one query covers them all.
	posts := make([]*model.Post, 0, len(postList.Posts))
	for _, p := range postList.Posts {
		posts = append(posts, p)
	}

	hydrated, appErr := a.hydratePostValues(rctx, posts)
	if appErr != nil {
		return nil, appErr
	}

	// Build a fresh PostList wrapper so we don't mutate a cached one. The
	// store layer caches *model.PostList (and its inner Posts map) for the
	// common page sizes (see LocalCachePostStore.GetPosts) — mutating either
	// the map or the *Post pointers would poison the cache for every
	// subsequent reader. Allowed posts reuse the original pointer; denied
	// posts get a blanked clone via blankedPostFor.
	out := *postList
	out.Posts = make(map[string]*model.Post, len(postList.Posts))
	for id, p := range postList.Posts {
		out.Posts[id] = p
	}

	for _, pwv := range hydrated {
		if pwv == nil || pwv.Post == nil {
			continue
		}
		allow, evalErr := ac.EvaluatePostPolicies(rctx, pwv.ChannelId, pwv, subject)
		if evalErr != nil {
			rctx.Logger().Warn("post policy evaluation failed; failing closed",
				mlog.String("post_id", pwv.Id),
				mlog.String("channel_id", pwv.ChannelId),
				mlog.Err(evalErr))
			out.Posts[pwv.Id] = blankedPostFor(out.Posts[pwv.Id])
			continue
		}
		if !allow {
			out.Posts[pwv.Id] = blankedPostFor(out.Posts[pwv.Id])
		}
	}

	return &out, nil
}

// EvaluatePostPolicyForRecipient is the SuiteIFace entry point used by the
// WS posted broadcast hook. Returns true (allow) when the feature flag is
// off, when no enterprise access-control service is loaded, or when every
// applicable post_filter policy on the channel allows the recipient. Returns
// false (deny) when any policy denies, when subject build fails, or when
// the evaluator returns an error (fail-closed).
//
// postValues is the already-hydrated property values map for the post; the
// hook hydrates once on the sender side and passes the map through the hook
// args so per-recipient evaluation skips the store roundtrip.
func (a *App) EvaluatePostPolicyForRecipient(rctx request.CTX, channelID string, postID string, userID string, postValues map[string]any) bool {
	if !a.Config().FeatureFlags.PostPolicy {
		return true
	}
	ac := a.Srv().Channels().AccessControl
	if ac == nil {
		return true
	}

	subject, appErr := a.BuildAccessControlSubject(rctx, userID, "")
	if appErr != nil {
		rctx.Logger().Warn("post policy: failed to build subject; failing closed",
			mlog.String("user_id", userID),
			mlog.String("channel_id", channelID),
			mlog.Err(appErr))
		return false
	}

	pwv := &model.PostWithValues{
		Post:   &model.Post{Id: postID, ChannelId: channelID},
		Values: postValues,
	}
	allow, evalErr := ac.EvaluatePostPolicies(rctx, channelID, pwv, subject)
	if evalErr != nil {
		rctx.Logger().Warn("post policy: per-recipient evaluation failed; failing closed",
			mlog.String("user_id", userID),
			mlog.String("post_id", postID),
			mlog.String("channel_id", channelID),
			mlog.Err(evalErr))
		return false
	}
	return allow
}

// filterSinglePostByPostPolicy is the single-post variant used by callers
// like GetSinglePost / GetPermalinkPost. Returns the post (possibly
// blanked) on allow/deny. Returns an AppError only when hydration or
// subject build fails.
func (a *App) filterSinglePostByPostPolicy(rctx request.CTX, post *model.Post, userID string) (*model.Post, *model.AppError) {
	if post == nil {
		return nil, model.NewAppError("filterSinglePostByPostPolicy", "app.post.get.app_error", nil, "", http.StatusBadRequest)
	}
	if !a.Config().FeatureFlags.PostPolicy {
		return post, nil
	}
	ac := a.Srv().Channels().AccessControl
	if ac == nil {
		return post, nil
	}

	subject, appErr := a.BuildAccessControlSubject(rctx, userID, "")
	if appErr != nil {
		return nil, appErr
	}

	hydrated, appErr := a.hydratePostValues(rctx, []*model.Post{post})
	if appErr != nil {
		return nil, appErr
	}
	if len(hydrated) == 0 || hydrated[0] == nil {
		return post, nil
	}

	allow, evalErr := ac.EvaluatePostPolicies(rctx, hydrated[0].ChannelId, hydrated[0], subject)
	if evalErr != nil {
		rctx.Logger().Warn("post policy evaluation failed; failing closed",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
			mlog.Err(evalErr))
		return blankedPostFor(post), nil
	}
	if !allow {
		return blankedPostFor(post), nil
	}
	return post, nil
}
