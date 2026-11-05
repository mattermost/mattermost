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
		// Hydration was requested for this post, so the response says how it went even when it
		// went fine; a response without the flag tells the client to keep what it has. A failed
		// lookup below overwrites this with true.
		post.Metadata.PropertyValuesUnavailable = model.NewPointer(false)
		eligible = append(eligible, post)
	}

	if len(eligible) == 0 {
		return
	}

	// Identify the viewer so a redaction hook on the group can filter per
	// caller. A local-mode session has no UserId and is tagged as the local
	// admin; tagging its empty UserId would have the access control hook
	// refuse every read.
	rctx = rctxWithSessionCallerID(rctx)

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
		post.Metadata.PropertyValuesUnavailable = model.NewPointer(true)
	}
}

// PreparePostPropertyValuesForCreate checks values submitted for a post about to be created in
// channel and returns fresh PropertyValues carrying only the group, the field and the value,
// together with the field each one is for, in the same order. It runs before the post is saved,
// so bad input is refused before there is a post to roll back.
//
// It does not check whether the caller may set the values: an API caller asks
// CanSetPostPropertyValueOnCreate for each returned field, and every caller's write is judged
// again by the property hook when CreatePost stores the values. Nor does it check the feature
// flag; callers do that first, so a request with the flag off makes no lookup.
//
// Errors never name an attribute: which attributes a server defines is itself sensitive, and
// the caller may not be allowed to see them.
func (a *App) PreparePostPropertyValuesForCreate(rctx request.CTX, submitted []*model.PropertyValue, channel *model.Channel) ([]*model.PropertyValue, []*model.PropertyField, *model.AppError) {
	invalid := func(detail string) *model.AppError {
		return model.NewAppError("PreparePostPropertyValuesForCreate", "api.post.create_post.invalid_attribute.app_error", nil, detail, http.StatusBadRequest)
	}

	group, appErr := a.GetPropertyGroup(rctx, model.PostAttributesPropertyGroupName)
	if appErr != nil {
		return nil, nil, appErr
	}

	// One call covers all three scopes a post's fields can come from: the system, the
	// post's team and its channel.
	fields, appErr := a.SearchPropertyFields(rctx, group.ID, model.PropertyFieldSearchOpts{
		ObjectTypes: []string{model.PropertyFieldObjectTypePost},
		ChannelID:   channel.Id,
		TeamID:      channel.TeamId,
		PerPage:     model.PostAttributesMaxApplicableFields + 1,
	})
	if appErr != nil {
		return nil, nil, appErr
	}

	// The per-target cap keeps a post's applicable fields within the page. Were it ever
	// bypassed, a field past PostAttributesMaxApplicableFields would be refused as unknown.
	fieldByID := make(map[string]*model.PropertyField, len(fields))
	for _, field := range fields {
		fieldByID[field.ID] = field
	}

	seen := make(map[string]bool, len(submitted))
	values := make([]*model.PropertyValue, 0, len(submitted))
	valueFields := make([]*model.PropertyField, 0, len(submitted))
	for _, item := range submitted {
		if item == nil {
			return nil, nil, invalid("nil value")
		}
		// The caller submits full PropertyValue structs, so everything the server owns has to
		// be rejected rather than quietly dropped: a caller that sent an ID or a TargetID meant
		// something by it and should not be told the write succeeded as asked.
		if hasServerOwnedFields(item) {
			return nil, nil, invalid("server-owned field set by caller")
		}
		if !model.IsValidId(item.FieldID) {
			return nil, nil, invalid("invalid field id")
		}
		if seen[item.FieldID] {
			return nil, nil, invalid("duplicate field")
		}
		field, ok := fieldByID[item.FieldID]
		if !ok {
			return nil, nil, invalid("unknown field")
		}

		seen[item.FieldID] = true
		values = append(values, &model.PropertyValue{
			GroupID: group.ID,
			FieldID: field.ID,
			Value:   item.Value,
		})
		valueFields = append(valueFields, field)
	}

	return values, valueFields, nil
}

// hasServerOwnedFields reports whether a submitted value sets anything the server assigns
// itself when it writes the value.
func hasServerOwnedFields(v *model.PropertyValue) bool {
	return v.ID != "" || v.GroupID != "" || v.TargetID != "" || v.TargetType != "" ||
		v.CreateAt != 0 || v.UpdateAt != 0 || v.DeleteAt != 0 ||
		v.CreatedBy != "" || v.UpdatedBy != ""
}

// CanSetPostPropertyValueOnCreate reports whether userID may set field's value on a post they
// are about to create in channel.
//
// A nil or unrecognised level denies, matching the property API.
//
// The property access-control hook evaluates the write again after the post is saved, so this
// helper's job is to give the caller an early refusal before the post exists. Where the two
// disagree, for example a field whose Permissions grant a value write to a human this helper
// denies, this helper's answer wins for callers going through post creation.
func (a *App) CanSetPostPropertyValueOnCreate(rctx request.CTX, userID string, field *model.PropertyField, channel *model.Channel) bool {
	if field == nil || field.PermissionValues == nil || channel == nil {
		return false
	}

	switch *field.PermissionValues {
	case model.PermissionLevelMember:
		ok, _ := a.HasPermissionToChannel(rctx, userID, channel.Id, model.PermissionReadChannel)
		return ok
	case model.PermissionLevelCreator:
		// The author of a post they are creating is themselves.
		return true
	case model.PermissionLevelAdmin:
		return a.hasChannelPropertyAdmin(rctx, userID, channel.Id)
	case model.PermissionLevelSysadmin:
		return a.HasPermissionTo(rctx, userID, model.PermissionManageSystem)
	default:
		return false
	}
}

// setPostPropertyValuesOnCreate writes a new post's attribute values and removes the post
// again if that write fails.
//
// The write runs before anything announces the post: no `posted` event, no notification and no
// MessageHasBeenPosted hook has fired yet.
func (a *App) setPostPropertyValuesOnCreate(rctx request.CTX, post *model.Post, values []*model.PropertyValue) *model.AppError {
	// The permission hook behind UpsertPropertyValues loads the post to resolve its channel
	// and author. The post was saved a moment ago, so a replica may not have it yet.
	rctx = RequestContextWithMaster(rctxWithSessionCallerID(rctx))

	for _, value := range values {
		value.TargetID = post.Id
		value.TargetType = model.PropertyValueTargetTypePost
		value.CreatedBy = post.UserId
		value.UpdatedBy = post.UserId
	}

	written, appErr := a.UpsertPropertyValues(rctx, values, model.PropertyFieldObjectTypePost, post.Id, "")
	if appErr == nil {
		// Attach rather than re-read: this runs before PreparePostForClient and
		// handlePostEvents, so both the response and the `posted` event carry them.
		if post.Metadata == nil {
			post.Metadata = &model.PostMetadata{}
		}
		// These values go to every channel member in the single `posted` payload. That is only
		// correct while nothing redacts post attribute values per viewer; once post attributes
		// are subject to per-viewer access control, this attach must be filtered per recipient.
		post.Metadata.PropertyValues = written
		return nil
	}

	if deleteErr := a.PermanentDeletePost(rctx, post.Id, post.UserId); deleteErr != nil {
		// The post now exists without the values it was created with, which is the state
		// this path exists to prevent — logged loudly rather than folded into the returned
		// error.
		rctx.Logger().Error("Failed to remove post after its attribute values could not be written",
			mlog.String("post_id", post.Id),
			mlog.Err(deleteErr))
	}

	return appErr
}
