// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// embedPostPropertiesForSync mutates each post in sd.posts to include resolved
// PropertyField/PropertyValue pairs as a flat string map under Post.Props.
// IDs are resolved to human-readable text (option/user names) so the receiving
// remote can display them without having any of the source PropertyField
// definitions.
func (scs *Service) embedPostPropertiesForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "PostProperties", time.Since(start).Seconds())
		}
	}()

	if len(sd.posts) == 0 {
		return nil
	}

	// Resolve the channel-post property group id once per sync cycle.
	group, err := scs.server.GetStore().PropertyGroup().Get(model.ChannelPostPropertyGroupName)
	if err != nil {
		// No group registered yet means no post properties exist anywhere — nothing to embed.
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug,
			"channel post property group not found; skipping embed",
			mlog.Err(err))
		return nil
	}

	postIDs := make([]string, 0, len(sd.posts))
	for _, p := range sd.posts {
		postIDs = append(postIDs, p.Id)
	}

	values, err := scs.server.GetStore().PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
		GroupID:        group.ID,
		TargetType:     "post",
		TargetIDs:      postIDs,
		IncludeDeleted: false,
		PerPage:        -1,
	})
	if err != nil {
		return fmt.Errorf("could not load property values for post sync: %w", err)
	}
	if len(values) == 0 {
		return nil
	}

	fieldIDSet := make(map[string]struct{}, len(values))
	for _, v := range values {
		fieldIDSet[v.FieldID] = struct{}{}
	}
	fieldIDs := make([]string, 0, len(fieldIDSet))
	for id := range fieldIDSet {
		fieldIDs = append(fieldIDs, id)
	}

	fields, err := scs.server.GetStore().PropertyField().GetMany(context.Background(), group.ID, fieldIDs)
	if err != nil {
		return fmt.Errorf("could not load property fields for post sync: %w", err)
	}
	fieldByID := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldByID[f.ID] = f
	}

	// Collect every userID referenced by user/multiuser values so we can do a single
	// User store lookup instead of N round trips.
	userIDsNeeded := collectUserIDsFromValues(values, fieldByID)
	userByID := make(map[string]*model.User, len(userIDsNeeded))
	if len(userIDsNeeded) > 0 {
		rctx := request.EmptyContext(scs.server.Log())
		users, uerr := scs.server.GetStore().User().GetProfileByIds(rctx, userIDsNeeded, nil, true)
		if uerr != nil {
			// Soft failure — we still want to embed everything else and use the
			// "(unknown user)" placeholder for users we cannot resolve.
			scs.server.Log().LogM(mlog.MlvlSharedChannelServiceWarn,
				"Could not load users for property-value embed; using placeholder for missing",
				mlog.Err(uerr))
		} else {
			for _, u := range users {
				userByID[u.Id] = u
			}
		}
	}

	valuesByPost := make(map[string][]*model.PropertyValue, len(sd.posts))
	for _, v := range values {
		valuesByPost[v.TargetID] = append(valuesByPost[v.TargetID], v)
	}

	nameFormat := *scs.server.Config().TeamSettings.TeammateNameDisplay

	for _, post := range sd.posts {
		pv := valuesByPost[post.Id]
		if len(pv) == 0 {
			continue
		}
		if post.Props == nil {
			post.Props = model.StringInterface{}
		}
		for _, v := range pv {
			f := fieldByID[v.FieldID]
			if f == nil {
				continue
			}
			text, ok := renderPropertyValueAsText(v, f, userByID, nameFormat)
			if !ok {
				continue
			}
			post.Props[f.Name] = text
		}
	}
	return nil
}

// collectUserIDsFromValues walks a PropertyValue slice and returns the set of
// userIDs referenced by user/multiuser fields. Returned slice is stable-but-
// unspecified order; callers must not rely on it.
func collectUserIDsFromValues(values []*model.PropertyValue, fieldByID map[string]*model.PropertyField) []string {
	set := make(map[string]struct{})
	for _, v := range values {
		f := fieldByID[v.FieldID]
		if f == nil {
			continue
		}
		switch f.Type {
		case model.PropertyFieldTypeUser:
			var id string
			if err := json.Unmarshal(v.Value, &id); err == nil && id != "" {
				set[id] = struct{}{}
			}
		case model.PropertyFieldTypeMultiuser:
			var ids []string
			if err := json.Unmarshal(v.Value, &ids); err == nil {
				for _, id := range ids {
					if id != "" {
						set[id] = struct{}{}
					}
				}
			}
		}
	}
	out := make([]string, 0, len(set))
	for id := range set {
		out = append(out, id)
	}
	return out
}

// renderPropertyValueAsText converts a single PropertyValue into its display
// string per the rules in spec §4.5. Returns ("", false) when the caller should
// omit the key entirely (malformed JSON, value type unhandled in a non-string
// way). Missing references (deleted user/option) render placeholder text and
// return ok==true so the receiving remote still sees the field, just with a
// reduced value.
func renderPropertyValueAsText(
	v *model.PropertyValue,
	f *model.PropertyField,
	userByID map[string]*model.User,
	nameFormat string,
) (string, bool) {
	switch f.Type {
	case model.PropertyFieldTypeText:
		var s string
		if err := json.Unmarshal(v.Value, &s); err != nil {
			return "", false
		}
		return s, true

	case model.PropertyFieldTypeDate:
		// Stored as ISO-8601 string today.
		var s string
		if err := json.Unmarshal(v.Value, &s); err == nil {
			return s, true
		}
		return "", false

	case model.PropertyFieldTypeSelect:
		var id string
		if err := json.Unmarshal(v.Value, &id); err != nil {
			return "", false
		}
		if id == "" {
			return "", false
		}
		name, found := optionNameByID(f, id)
		if !found {
			return "(unknown option)", true
		}
		return name, true

	case model.PropertyFieldTypeMultiselect:
		var ids []string
		if err := json.Unmarshal(v.Value, &ids); err != nil {
			return "", false
		}
		if len(ids) == 0 {
			return "", true
		}
		parts := make([]string, 0, len(ids))
		for _, id := range ids {
			if name, found := optionNameByID(f, id); found {
				parts = append(parts, name)
			} else {
				parts = append(parts, "(unknown option)")
			}
		}
		return strings.Join(parts, ", "), true

	case model.PropertyFieldTypeUser:
		var id string
		if err := json.Unmarshal(v.Value, &id); err != nil {
			return "", false
		}
		if id == "" {
			return "", false
		}
		u, ok := userByID[id]
		if !ok || u == nil {
			return "(unknown user)", true
		}
		return userDisplayText(u, nameFormat), true

	case model.PropertyFieldTypeMultiuser:
		var ids []string
		if err := json.Unmarshal(v.Value, &ids); err != nil {
			return "", false
		}
		if len(ids) == 0 {
			return "", true
		}
		parts := make([]string, 0, len(ids))
		for _, id := range ids {
			if u, ok := userByID[id]; ok && u != nil {
				parts = append(parts, userDisplayText(u, nameFormat))
			} else {
				parts = append(parts, "(unknown user)")
			}
		}
		return strings.Join(parts, ", "), true
	}

	// Unknown / future field type: best-effort pass-through as a string so we
	// don't drop newly-introduced data silently.
	var s string
	if err := json.Unmarshal(v.Value, &s); err == nil {
		return s, true
	}
	return "", false
}

// optionNameByID looks up the option name for a select/multiselect field by its
// option id. Returns (name, true) on hit, ("", false) otherwise.
func optionNameByID(f *model.PropertyField, id string) (string, bool) {
	if f.Attrs == nil {
		return "", false
	}
	raw, ok := f.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return "", false
	}
	// Attrs[options] arrives as []any of map[string]any after JSON round-trip;
	// marshal+unmarshal coerces it into a typed shape we can read.
	optsBytes, err := json.Marshal(raw)
	if err != nil {
		return "", false
	}
	var opts []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(optsBytes, &opts); err != nil {
		return "", false
	}
	for _, o := range opts {
		if o.ID == id {
			return o.Name, true
		}
	}
	return "", false
}

// userDisplayText prefers GetDisplayName under the configured nameFormat,
// falling back to the username if the configured display name is empty.
func userDisplayText(u *model.User, nameFormat string) string {
	if name := u.GetDisplayName(nameFormat); name != "" {
		return name
	}
	return u.Username
}

// fetchPropertyValueDeltaForSync walks PropertyValues whose UpdateAt is greater
// than the remote's LastPropertyValueUpdateAt cursor and adds the affected
// posts to sd.posts (when they belong to this channel and are not already in
// sd.posts). The next-cursor value is the max PropertyValue.UpdateAt observed
// in this batch, regardless of whether the value's target post survives the
// channel/echo filter — this guarantees forward progress even when the only
// changes are for posts in other channels.
func (scs *Service) fetchPropertyValueDeltaForSync(sd *syncData) error {
	start := time.Now()
	defer func() {
		if metrics := scs.server.GetMetrics(); metrics != nil {
			metrics.ObserveSharedChannelsSyncCollectionStepDuration(sd.rc.RemoteId, "PropertyValueDelta", time.Since(start).Seconds())
		}
	}()

	group, err := scs.server.GetStore().PropertyGroup().Get(model.ChannelPostPropertyGroupName)
	if err != nil {
		// No group registered — nothing to walk yet.
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug,
			"channel post property group not found; skipping property-value delta",
			mlog.Err(err))
		return nil
	}

	maxPostsPerSync := *scs.server.Config().ConnectedWorkspacesSettings.MaxPostsPerSync

	values, err := scs.server.GetStore().PropertyValue().SearchPropertyValues(model.PropertyValueSearchOpts{
		GroupID:        group.ID,
		TargetType:     "post",
		SinceUpdateAt:  sd.scr.LastPropertyValueUpdateAt,
		IncludeDeleted: true, // deletes need to propagate as a re-emit too
		PerPage:        maxPostsPerSync * 4,
	})
	if err != nil {
		return fmt.Errorf("could not search property-value delta: %w", err)
	}
	if len(values) == 0 {
		return nil
	}

	nextCursor := sd.resultNextPropertyValueCursor
	postIDSet := make(map[string]struct{}, len(values))
	for _, v := range values {
		if v.UpdateAt > nextCursor {
			nextCursor = v.UpdateAt
		}
		postIDSet[v.TargetID] = struct{}{}
	}
	sd.resultNextPropertyValueCursor = nextCursor

	// Skip posts already in sd.posts; only fetch those we haven't seen yet.
	inSD := make(map[string]struct{}, len(sd.posts))
	for _, p := range sd.posts {
		inSD[p.Id] = struct{}{}
	}
	fetchIDs := make([]string, 0, len(postIDSet))
	for id := range postIDSet {
		if _, ok := inSD[id]; ok {
			continue
		}
		fetchIDs = append(fetchIDs, id)
	}
	if len(fetchIDs) == 0 {
		return nil
	}

	posts, err := scs.server.GetStore().Post().GetPostsByIds(fetchIDs)
	if err != nil {
		return fmt.Errorf("could not fetch property-changed posts: %w", err)
	}

	// Channel-scoping is post-hoc in Go (MVP shortcut — flagged for production
	// in sc-tasks/spec.md). We also honor the same "don't sync back to the
	// originating remote" rule that filterPostsForSync applies.
	for _, p := range posts {
		if p.ChannelId != sd.task.channelID {
			continue
		}
		if p.GetRemoteID() == sd.rc.RemoteId {
			continue
		}
		sd.posts = append(sd.posts, p)
	}
	return nil
}
