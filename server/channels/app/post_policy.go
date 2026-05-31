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

	values, appErr := a.SearchPropertyValues(rctx, group.ID, model.PropertyValueSearchOpts{
		GroupID:    group.ID,
		TargetType: model.PropertyValueTargetTypePost,
		TargetIDs:  postIDs,
		PerPage:    -1,
	})
	if appErr != nil {
		return nil, appErr
	}

	// Lookup table: field ID → field name (one search query for the group).
	fields, appErr := a.SearchPropertyFields(rctx, group.ID, model.PropertyFieldSearchOpts{
		GroupID: group.ID,
		PerPage: -1,
	})
	if appErr != nil {
		return nil, appErr
	}
	fieldNameByID := make(map[string]string, len(fields))
	for _, f := range fields {
		fieldNameByID[f.ID] = f.Name
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

// blankPostInPlace clears the user-visible content of a post and marks it
// with the PostPropsHiddenByPolicy sentinel so the client can render a
// "Hidden by policy" placeholder. Timeline-essential fields (Id, UserId,
// ChannelId, CreateAt, Type) are preserved so list order and authorship
// remain intact.
func blankPostInPlace(p *model.Post) {
	if p == nil {
		return
	}
	p.Message = ""
	p.FileIds = nil
	p.DelProp(model.PostPropsAttachments)
	if p.Props == nil {
		p.Props = model.StringInterface{}
	}
	p.Props[model.PostPropsHiddenByPolicy] = true
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
			blankPostInPlace(postList.Posts[pwv.Id])
			continue
		}
		if !allow {
			blankPostInPlace(postList.Posts[pwv.Id])
		}
	}

	return postList, nil
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
		blankPostInPlace(post)
		return post, nil
	}
	if !allow {
		blankPostInPlace(post)
	}
	return post, nil
}
