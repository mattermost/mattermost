// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// A field is masked when it carries a permissions.masking object at all --
// even an empty one. What masking applies to a field, and where the caller's
// holdings are read from, is resolved here; matching a caller against it is
// elsewhere in this package, and filtering a read on the answer is elsewhere
// still.
//
// Masking is declared where the scheme lives, not on every field that shares
// it: only a template or a field with no LinkedFieldID may carry a masking
// object. A field linked to a template inherits the template's object whole
// -- including its except list -- and any masking of its own is ignored
// rather than merged, so a stray one (from a direct store write, or a data
// migration that has not caught up) can never widen what a linked field's own
// masking would have narrowed. The resolution is therefore flat: a linked
// field's masking is its template's, and any other field's is its own.
//
// Holdings resolve the same way: a template's own mask_by_field_id, if it
// sets one, names the field a caller's holdings live on; if it sets none, the
// holdings live on the field being read itself -- not on the template that
// was consulted for the masking object, when the two differ.

// fieldMasking is the resolved masking answer for one field: the masking
// object that applies (nil when the field is not masked) and the ID of the
// field the caller's holdings are read from.
type fieldMasking struct {
	masking         *model.Masking
	holdingsFieldID string
}

// maskingContext memoizes fieldMasking resolution within one hook call that
// reads several values on one field, the same "resolve once per batch, not
// once per item" problem valueWriteAccessCache already solves for writes: a
// batch read of 50 values on one field must not load the template 50 times.
type maskingContext map[string]fieldMasking

// resolve returns the masking that applies to field and where its holdings
// live, computing it once per field ID for the lifetime of the
// maskingContext.
func (c maskingContext) resolve(h *AccessControlHook, field *model.PropertyField) (fieldMasking, error) {
	if fm, ok := c[field.ID]; ok {
		return fm, nil
	}
	fm, err := h.resolveFieldMasking(field)
	if err != nil {
		return fieldMasking{}, err
	}
	c[field.ID] = fm
	return fm, nil
}

// resolveFieldMasking answers what masks field and where the caller's
// holdings for it are read from. An unmasked field resolves to a zero
// fieldMasking (masking is nil).
func (h *AccessControlHook) resolveFieldMasking(field *model.PropertyField) (fieldMasking, error) {
	target := field
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		template, err := h.propertyService.getPropertyField(field.GroupID, *field.LinkedFieldID)
		if err != nil {
			return fieldMasking{}, errors.Wrapf(err, "failed to resolve masking template %q for field %q", *field.LinkedFieldID, field.ID)
		}
		// The field's own masking, if it has one, was rejected on save and is
		// ignored here rather than merged -- only the template's applies.
		target = template
	}

	if target.Permissions == nil || target.Permissions.Masking == nil {
		return fieldMasking{}, nil
	}

	masking := target.Permissions.Masking
	// Default to the field being read, not target -- target is the template
	// when field links to one, and an unset mask_by_field_id means holdings
	// live on field itself, never on the template consulted for the masking
	// object.
	holdingsFieldID := field.ID
	if masking.MaskByFieldID != "" {
		holdingsFieldID = masking.MaskByFieldID
	}

	return fieldMasking{masking: masking, holdingsFieldID: holdingsFieldID}, nil
}
