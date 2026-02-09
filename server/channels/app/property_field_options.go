// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// AssignOptionIDs assigns IDs to options if they're empty (for select/multiselect fields).
// This is a shared utility used by all property field types (Board Attributes, Custom Profile Attributes, etc.).
// Options without IDs will be assigned new IDs using model.NewId().
func AssignOptionIDs(field *model.PropertyField) {
	if field.Type != model.PropertyFieldTypeSelect && field.Type != model.PropertyFieldTypeMultiselect {
		return
	}

	if options, ok := field.Attrs[model.PropertyFieldAttributeOptions]; ok {
		if optionsArr, ok := options.([]any); ok {
			for i := range optionsArr {
				if optionMap, ok := optionsArr[i].(map[string]any); ok {
					if id, ok := optionMap["id"].(string); !ok || id == "" {
						optionMap["id"] = model.NewId()
					}
				}
			}
		}
	}
}

// ClearOptionsIfNotSelect clears the options attribute from a field if it's not a select or multiselect type.
// This is used when changing field types to ensure invalid options are removed.
func ClearOptionsIfNotSelect(field *model.PropertyField) {
	if field.Type != model.PropertyFieldTypeSelect && field.Type != model.PropertyFieldTypeMultiselect {
		delete(field.Attrs, model.PropertyFieldAttributeOptions)
	}
}

// SanitizePropertyFieldOptions handles option ID assignment and clearing for property fields.
// This is a convenience function that combines AssignOptionIDs and ClearOptionsIfNotSelect.
// It should be called before saving property fields to ensure options are properly formatted.
func SanitizePropertyFieldOptions(field *model.PropertyField) {
	ClearOptionsIfNotSelect(field)
	AssignOptionIDs(field)
}
