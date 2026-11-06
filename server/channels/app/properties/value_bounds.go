// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// errBoundsCheckFailed marks a bounds rule that can't be checked because the
// data it depends on is broken, such as a missing parent object. It refuses the
// write, unlike a rule that simply has nothing to compare against.
var errBoundsCheckFailed = errors.New("bounds check failed")

// boundsParent returns the field and the object that hold the value a parent
// rule on field compares against, for a value written to targetID. Every
// failure to find them refuses the write: a store error is returned wrapped, and
// anything missing or ambiguous wraps errBoundsCheckFailed. Messages name IDs,
// never a value.
func (h *AccessControlAttributeValidationHook) boundsParent(rctx request.CTX, field *model.PropertyField, targetID string) (parentField *model.PropertyField, parentTargetType, parentTargetID string, err error) {
	switch field.ObjectType {
	case model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeUser:
		parentTargetType, parentTargetID = model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID
	case model.PropertyFieldObjectTypePost:
		if h.postChannelResolver == nil {
			return nil, "", "", fmt.Errorf("field %s: no way to find the channel of post %s: %w", field.ID, targetID, errBoundsCheckFailed)
		}
		channelID, resolveErr := h.postChannelResolver(rctx, targetID)
		if resolveErr != nil {
			return nil, "", "", fmt.Errorf("field %s: could not find the channel of post %s: %v: %w", field.ID, targetID, resolveErr, errBoundsCheckFailed)
		}
		if channelID == "" {
			return nil, "", "", fmt.Errorf("field %s: post %s has no channel: %w", field.ID, targetID, errBoundsCheckFailed)
		}
		parentTargetType, parentTargetID = model.PropertyValueTargetTypeChannel, channelID
	default:
		return nil, "", "", fmt.Errorf("field %s: object type %q has no parent: %w", field.ID, field.ObjectType, errBoundsCheckFailed)
	}

	matches, err := h.propertyService.parentMatchingFields(rctx, field)
	if err != nil {
		return nil, "", "", fmt.Errorf("field %s: failed to look up the parent's field for target %s: %w", field.ID, targetID, err)
	}
	if len(matches) != 1 {
		found := "none"
		if len(matches) > 1 {
			found = "more than one"
		}
		return nil, "", "", fmt.Errorf("field %s: target %s needs exactly one parent field, found %s: %w", field.ID, targetID, found, errBoundsCheckFailed)
	}
	return matches[0], parentTargetType, parentTargetID, nil
}
