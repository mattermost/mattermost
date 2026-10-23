// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	// propertyValuesHookMaxValues bounds the values, and separately the previous values, that one
	// PropertyValuesHaveBeenUpdated call carries. Larger changes are split into several calls.
	propertyValuesHookMaxValues = 100

	// propertyValuesHookPageSize and propertyValuesHookMaxScanned bound the stored values read per
	// target to find the previous values of a write. A target with more values than that reports
	// no previous value for the fields beyond them.
	propertyValuesHookPageSize   = 200
	propertyValuesHookMaxScanned = 1000
)

// propertyValuesTarget is the object a property value belongs to.
type propertyValuesTarget struct {
	targetType string
	targetID   string
}

// propertyValuesHookEnabled reports whether an active plugin implements
// PropertyValuesHaveBeenUpdated, so that writes only read previous values when someone will
// receive them.
func (a *App) propertyValuesHookEnabled() bool {
	env := a.GetPluginsEnvironment()
	return env != nil && env.HasPluginImplementing(plugin.PropertyValuesHaveBeenUpdatedID)
}

// clonePropertyValues deep-copies values, dropping nil entries, so the hook goroutine never shares
// them with the caller and gob never meets a nil element.
func clonePropertyValues(values []*model.PropertyValue) []*model.PropertyValue {
	cloned := make([]*model.PropertyValue, 0, len(values))
	for _, v := range values {
		if v == nil {
			continue
		}
		c := *v
		if v.Value != nil {
			c.Value = append([]byte(nil), v.Value...)
		}
		cloned = append(cloned, &c)
	}
	return cloned
}

// storedPropertyValues reads the stored values of a target in a group, in pages, up to
// propertyValuesHookMaxScanned. keep selects the values to return; nil keeps all of them. It reads
// the store directly: the hook is a server-to-plugin notification, so values are not filtered for
// the requesting user. A read error is logged and returns what was read so far.
func (a *App) storedPropertyValues(rctx request.CTX, groupID string, target propertyValuesTarget, keep func(*model.PropertyValue) bool) []*model.PropertyValue {
	opts := model.PropertyValueSearchOpts{
		GroupID:    groupID,
		TargetType: target.targetType,
		TargetIDs:  []string{target.targetID},
		PerPage:    propertyValuesHookPageSize,
	}
	var kept []*model.PropertyValue
	for scanned := 0; scanned < propertyValuesHookMaxScanned; {
		page, err := a.Srv().Store().PropertyValue().SearchPropertyValues(rctx, opts)
		if err != nil {
			rctx.Logger().Warn("Failed to read previous property values for plugins", mlog.String("group_id", groupID), mlog.String("target_id", target.targetID), mlog.Err(err))
			return kept
		}
		for _, v := range page {
			if keep == nil || keep(v) {
				kept = append(kept, v)
			}
		}
		scanned += len(page)
		if len(page) < opts.PerPage {
			break
		}
		last := page[len(page)-1]
		opts.Cursor = model.PropertyValueSearchCursor{PropertyValueID: last.ID, CreateAt: last.CreateAt}
	}
	return clonePropertyValues(kept)
}

// previousPropertyValues returns the stored values of the fields that values are about to write,
// for every target among them. It returns nil when no plugin implements
// PropertyValuesHaveBeenUpdated.
func (a *App) previousPropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) []*model.PropertyValue {
	if len(values) == 0 || !a.propertyValuesHookEnabled() {
		return nil
	}
	fieldsByTarget := map[propertyValuesTarget]map[string]bool{}
	var targets []propertyValuesTarget
	var ids []string
	for _, v := range values {
		if v == nil {
			continue
		}
		if v.TargetID == "" {
			// An update may name the value by ID alone.
			if model.IsValidId(v.ID) {
				ids = append(ids, v.ID)
			}
			continue
		}
		t := propertyValuesTarget{v.TargetType, v.TargetID}
		if fieldsByTarget[t] == nil {
			fieldsByTarget[t] = map[string]bool{}
			targets = append(targets, t)
		}
		fieldsByTarget[t][v.FieldID] = true
	}
	var previous []*model.PropertyValue
	for _, t := range targets {
		fields := fieldsByTarget[t]
		previous = append(previous, a.storedPropertyValues(rctx, groupID, t, func(v *model.PropertyValue) bool {
			return fields[v.FieldID]
		})...)
	}
	if len(ids) > 0 {
		byID, err := a.Srv().Store().PropertyValue().GetMany(groupID, ids)
		if err != nil {
			rctx.Logger().Warn("Failed to read previous property values for plugins", mlog.String("group_id", groupID), mlog.Err(err))
		} else {
			previous = append(previous, clonePropertyValues(byID)...)
		}
	}
	return previous
}

// propertyValuesHookUserID is the user a write is attributed to: the request's session user, or
// for requests without one, such as plugin API calls, the UpdatedBy of the written values.
func propertyValuesHookUserID(rctx request.CTX, values []*model.PropertyValue) string {
	if session := rctx.Session(); session != nil && model.IsValidId(session.UserId) {
		return session.UserId
	}
	for _, v := range values {
		if v != nil && model.IsValidId(v.UpdatedBy) {
			return v.UpdatedBy
		}
	}
	return ""
}

// propertyValuesHookCall is one invocation of PropertyValuesHaveBeenUpdated.
type propertyValuesHookCall struct {
	target   propertyValuesTarget
	values   []*model.PropertyValue
	previous []*model.PropertyValue
}

// propertyValuesHookCalls splits a write into invocations: one per target, in the order targets
// first appear, each with at most propertyValuesHookMaxValues fields. Written fields come first, then
// fields that only have a previous value, which were deleted.
func propertyValuesHookCalls(written, previous []*model.PropertyValue) []propertyValuesHookCall {
	type targetFields struct {
		fields   []string
		values   map[string]*model.PropertyValue
		previous map[string]*model.PropertyValue
	}
	byTarget := map[propertyValuesTarget]*targetFields{}
	var targets []propertyValuesTarget
	entry := func(v *model.PropertyValue) *targetFields {
		t := propertyValuesTarget{v.TargetType, v.TargetID}
		tf := byTarget[t]
		if tf == nil {
			tf = &targetFields{values: map[string]*model.PropertyValue{}, previous: map[string]*model.PropertyValue{}}
			byTarget[t] = tf
			targets = append(targets, t)
		}
		return tf
	}
	for _, v := range written {
		tf := entry(v)
		if _, seen := tf.values[v.FieldID]; !seen {
			tf.fields = append(tf.fields, v.FieldID)
		}
		tf.values[v.FieldID] = v
	}
	for _, v := range previous {
		tf := entry(v)
		if _, seen := tf.previous[v.FieldID]; seen {
			continue
		}
		if _, written := tf.values[v.FieldID]; !written {
			tf.fields = append(tf.fields, v.FieldID)
		}
		tf.previous[v.FieldID] = v
	}

	var calls []propertyValuesHookCall
	for _, t := range targets {
		tf := byTarget[t]
		for start := 0; start < len(tf.fields); start += propertyValuesHookMaxValues {
			end := min(start+propertyValuesHookMaxValues, len(tf.fields))
			call := propertyValuesHookCall{
				target:   t,
				values:   []*model.PropertyValue{},
				previous: []*model.PropertyValue{},
			}
			for _, fieldID := range tf.fields[start:end] {
				if v, ok := tf.values[fieldID]; ok {
					call.values = append(call.values, v)
				}
				if v, ok := tf.previous[fieldID]; ok {
					call.previous = append(call.previous, v)
				}
			}
			calls = append(calls, call)
		}
	}
	return calls
}

// runPropertyValuesHaveBeenUpdatedHook invokes PropertyValuesHaveBeenUpdated asynchronously for a
// committed write. written are the values as stored, empty for a deletion; previous are the stored
// values before the write, as previousPropertyValues or storedPropertyValues returned them.
func (a *App) runPropertyValuesHaveBeenUpdatedHook(rctx request.CTX, groupID string, written, previous []*model.PropertyValue) {
	if len(written) == 0 && len(previous) == 0 {
		return
	}
	if !a.propertyValuesHookEnabled() {
		return
	}
	userID := propertyValuesHookUserID(rctx, written)
	calls := propertyValuesHookCalls(clonePropertyValues(written), clonePropertyValues(previous))
	pCtx := pluginContext(rctx)
	a.Srv().Go(func() {
		for _, call := range calls {
			a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
				hooks.PropertyValuesHaveBeenUpdated(pCtx, userID, groupID, call.target.targetType, call.target.targetID, call.values, call.previous)
				return true
			}, plugin.PropertyValuesHaveBeenUpdatedID)
		}
	})
}
