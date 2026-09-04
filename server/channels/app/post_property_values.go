// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"cmp"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// hydratePropertyValues attaches the group's property values onto each post's metadata.
//
// Callers pass posts they have already established are eligible to carry values; this function
// deliberately does not re-derive any visibility rule.
//
// It never returns an error. A failed lookup marks the affected posts unavailable and logs, so
// that a caller asking for attributes still gets its posts back. A client can then tell "this
// post has no values" from "the values could not be loaded" instead of rendering an unmarked post.
func (a *App) hydratePropertyValues(rctx request.CTX, posts []*model.Post, groupID string) {
	eligible := make([]*model.Post, 0, len(posts))
	for _, post := range posts {
		if post == nil || post.Metadata == nil {
			continue
		}
		eligible = append(eligible, post)
	}

	if len(eligible) == 0 {
		return
	}

	// Identify the viewer so a redaction hook on the group can filter per caller.
	rctx = RequestContextWithCallerID(rctx, rctx.Session().UserId)

	// Fields are scoped per channel, so posts are grouped by channel.
	byChannel := map[string][]*model.Post{}
	for _, post := range eligible {
		byChannel[post.ChannelId] = append(byChannel[post.ChannelId], post)
	}

	for channelID, channelPosts := range byChannel {
		if err := a.hydrateChannelPropertyValues(rctx, channelID, channelPosts, groupID); err != nil {
			rctx.Logger().Warn(
				"Failed to hydrate post property values",
				mlog.String("group_id", groupID),
				mlog.String("channel_id", channelID),
				mlog.Int("post_count", len(channelPosts)),
				mlog.Err(err),
			)
			markPropertyValuesUnavailable(channelPosts)
		}
	}
}

// hydrateChannelPropertyValues hydrates one channel's worth of posts, whose applicable fields are
// all the same. Returns an error for the caller to translate into the unavailability marker.
func (a *App) hydrateChannelPropertyValues(rctx request.CTX, channelID string, posts []*model.Post, groupID string) error {
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}

	fields, appErr := a.SearchPropertyFields(rctx, groupID, model.PropertyFieldSearchOpts{
		ObjectTypes: []string{model.PropertyFieldObjectTypePost},
		ChannelID:   channelID,
		TeamID:      channel.TeamId,
		PerPage:     model.PostAttributesMaxApplicableFields + 1,
	})
	if appErr != nil {
		return appErr
	}

	// Over the bound means the per-target cap was bypassed and the page may be truncated, so the
	// value set below would be silently incomplete. Report unavailable rather than partial.
	if len(fields) > model.PostAttributesMaxApplicableFields {
		return model.NewAppError("hydratePropertyValues", "app.post.property_values.field_bound_exceeded.app_error",
			nil, "applicable field count exceeds the per-post bound", http.StatusInternalServerError)
	}

	applicable := make(map[string]*model.PropertyField, len(fields))
	for _, field := range fields {
		applicable[field.ID] = field
	}

	if len(applicable) == 0 {
		return nil
	}

	postIDs := make([]string, 0, len(posts))
	for _, post := range posts {
		postIDs = append(postIDs, post.Id)
	}
	slices.Sort(postIDs)

	values, appErr := a.SearchPropertyValues(rctx, groupID, model.PropertyValueSearchOpts{
		TargetType: model.PropertyValueTargetTypePost,
		TargetIDs:  postIDs,
		PerPage:    len(postIDs)*model.PostAttributesMaxApplicableFields + 1,
	})
	if appErr != nil {
		return appErr
	}

	if len(values) > len(postIDs)*model.PostAttributesMaxApplicableFields {
		return model.NewAppError("hydratePropertyValues", "app.post.property_values.value_bound_exceeded.app_error",
			nil, "value count exceeds the per-page bound", http.StatusInternalServerError)
	}

	byPost := make(map[string][]*model.PropertyValue, len(posts))
	for _, value := range values {
		// A value whose field is gone, or whose field is not a post field, is stale: the field
		// list is the authority on what applies.
		if _, ok := applicable[value.FieldID]; !ok {
			continue
		}
		byPost[value.TargetID] = append(byPost[value.TargetID], value)
	}

	for _, post := range posts {
		postValues := byPost[post.Id]
		if len(postValues) == 0 {
			continue
		}

		// Field creation order, so a client renders attributes consistently across posts and
		// across requests. FieldID breaks ties for fields created in the same millisecond.
		slices.SortFunc(postValues, func(a, b *model.PropertyValue) int {
			if c := cmp.Compare(applicable[a.FieldID].CreateAt, applicable[b.FieldID].CreateAt); c != 0 {
				return c
			}
			return cmp.Compare(a.FieldID, b.FieldID)
		})

		post.Metadata.PropertyValues = postValues
	}

	return nil
}

// markPropertyValuesUnavailable tells the client the lookup failed, so it renders the post as
// "attributes unknown" rather than as carrying none.
func markPropertyValuesUnavailable(posts []*model.Post) {
	for _, post := range posts {
		if post == nil || post.Metadata == nil {
			continue
		}
		post.Metadata.PropertyValuesUnavailable = true
	}
}
