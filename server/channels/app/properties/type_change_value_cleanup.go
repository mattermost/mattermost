// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// TypeChangeValueCleanupHook deletes a field's dependent property values when
// the field's Type changes on update. The Type column is part of the schema
// contract for stored values (e.g. select-option IDs are only valid against a
// matching select field), so leaving values behind across a type change leaves
// the field functionally broken until callers manually reset the values.
//
// The hook runs in PostUpdatePropertyFields. Earlier hooks
// (linked-property checks at the store layer) already reject the type-change
// cases that would corrupt linked state, so by the time this hook runs the
// only remaining type changes are on standalone fields where cleanup is the
// expected behavior. Cleanup failures are logged and skipped — the field
// update is not rolled back — to keep the operation atomic from the caller's
// perspective.
type TypeChangeValueCleanupHook struct {
	BasePropertyHook
	propertyService *PropertyService
}

var _ PropertyHook = (*TypeChangeValueCleanupHook)(nil)

// NewTypeChangeValueCleanupHook constructs the hook. The PropertyService
// reference is used to delete dependent values via the unexported
// deletePropertyValuesForField path so the hook does not re-enter the public
// hook chain (which would deadlock on its own pre-hook gating).
func NewTypeChangeValueCleanupHook(ps *PropertyService) *TypeChangeValueCleanupHook {
	return &TypeChangeValueCleanupHook{propertyService: ps}
}

// isSelectRankTransition reports whether a type change is between select and
// rank. Both types store values as a single option-ID string, so existing
// values remain valid after the transition and do not need to be cleared.
func isSelectRankTransition(from, to model.PropertyFieldType) bool {
	return (from == model.PropertyFieldTypeSelect || from == model.PropertyFieldTypeRank) &&
		(to == model.PropertyFieldTypeSelect || to == model.PropertyFieldTypeRank)
}

// PostUpdatePropertyFields returns the IDs of fields whose dependent values
// were cleared. The caller publishes the corresponding WS events. Linked-
// property propagation cannot trigger a type change (blocked upstream), so
// the propagated bucket is passed through unchanged.
func (h *TypeChangeValueCleanupHook) PostUpdatePropertyFields(rctx request.CTX, groupID string, prev, requested, propagated []*model.PropertyField) ([]*model.PropertyField, []*model.PropertyField, []string, error) {
	var cleared []string
	for i, u := range requested {
		if i >= len(prev) || prev[i] == nil || u == nil {
			continue
		}
		if prev[i].Type == u.Type {
			continue
		}
		if isSelectRankTransition(prev[i].Type, u.Type) {
			continue
		}
		if err := h.propertyService.deletePropertyValuesForField(groupID, u.ID); err != nil {
			rctx.Logger().Error("type-change value cleanup failed",
				mlog.String("group_id", groupID),
				mlog.String("field_id", u.ID),
				mlog.String("from_type", string(prev[i].Type)),
				mlog.String("to_type", string(u.Type)),
				mlog.Err(err),
			)
			continue
		}
		cleared = append(cleared, u.ID)
	}
	return requested, propagated, cleared, nil
}
