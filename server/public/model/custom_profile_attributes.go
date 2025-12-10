// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const CustomProfileAttributesPropertyGroupName = "custom_profile_attributes"

const (
	// Attributes keys
	CustomProfileAttributesPropertyAttrsSortOrder      = "sort_order"
	CustomProfileAttributesPropertyAttrsValueType      = "value_type"
	CustomProfileAttributesPropertyAttrsVisibility     = "visibility"
	CustomProfileAttributesPropertyAttrsLDAP           = "ldap"
	CustomProfileAttributesPropertyAttrsSAML           = "saml"
	CustomProfileAttributesPropertyAttrsManaged        = "managed"
	CustomProfileAttributesPropertyAttrsProtected      = "protected"
	CustomProfileAttributesPropertyAttrsSourcePluginID = "source_plugin_id"
	CustomProfileAttributesPropertyAttrsAccessMode     = "access_mode"

	// Access Modes
	CustomProfileAttributesAccessModePublic     = "public"
	CustomProfileAttributesAccessModeSourceOnly = "source_only"
	CustomProfileAttributesAccessModeSharedOnly = "shared_only"

	// Value Types
	CustomProfileAttributesValueTypeEmail = "email"
	CustomProfileAttributesValueTypeURL   = "url"
	CustomProfileAttributesValueTypePhone = "phone"

	// Visibility
	CustomProfileAttributesVisibilityHidden  = "hidden"
	CustomProfileAttributesVisibilityWhenSet = "when_set"
	CustomProfileAttributesVisibilityAlways  = "always"
	CustomProfileAttributesVisibilityDefault = CustomProfileAttributesVisibilityWhenSet

	// CPA options
	CPAOptionNameMaxLength  = 128
	CPAOptionColorMaxLength = 128

	// CPA value constraints
	CPAValueTypeTextMaxLength = 64
)

func IsKnownCPAValueType(valueType string) bool {
	switch valueType {
	case CustomProfileAttributesValueTypeEmail,
		CustomProfileAttributesValueTypeURL,
		CustomProfileAttributesValueTypePhone:
		return true
	}

	return false
}

func IsKnownCPAVisibility(visibility string) bool {
	switch visibility {
	case CustomProfileAttributesVisibilityHidden,
		CustomProfileAttributesVisibilityWhenSet,
		CustomProfileAttributesVisibilityAlways:
		return true
	}

	return false
}

func IsKnownCPAAccessMode(accessMode string) bool {
	switch accessMode {
	case CustomProfileAttributesAccessModePublic,
		CustomProfileAttributesAccessModeSourceOnly,
		CustomProfileAttributesAccessModeSharedOnly:
		return true
	}

	return false
}

type CustomProfileAttributesSelectOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

func (c CustomProfileAttributesSelectOption) GetID() string {
	return c.ID
}

func (c CustomProfileAttributesSelectOption) GetName() string {
	return c.Name
}

func (c *CustomProfileAttributesSelectOption) SetID(id string) {
	c.ID = id
}

func (c CustomProfileAttributesSelectOption) IsValid() error {
	if c.ID == "" {
		return errors.New("id cannot be empty")
	}

	if !IsValidId(c.ID) {
		return errors.New("id is not a valid ID")
	}

	if c.Name == "" {
		return errors.New("name cannot be empty")
	}

	if len(c.Name) > CPAOptionNameMaxLength {
		return fmt.Errorf("name is too long, max length is %d", CPAOptionNameMaxLength)
	}

	if c.Color != "" && len(c.Color) > CPAOptionColorMaxLength {
		return fmt.Errorf("color is too long, max length is %d", CPAOptionColorMaxLength)
	}

	return nil
}

type CPAField struct {
	PropertyField
	Attrs CPAAttrs `json:"attrs"`
}

type CPAAttrs struct {
	Visibility     string                                                `json:"visibility"`
	SortOrder      float64                                               `json:"sort_order"`
	Options        PropertyOptions[*CustomProfileAttributesSelectOption] `json:"options"`
	ValueType      string                                                `json:"value_type"`
	LDAP           string                                                `json:"ldap"`
	SAML           string                                                `json:"saml"`
	Managed        string                                                `json:"managed"`
	Protected      bool                                                  `json:"protected"`
	SourcePluginID string                                                `json:"source_plugin_id"`
	AccessMode     string                                                `json:"access_mode"`
}

func (c *CPAField) IsSynced() bool {
	return c.Attrs.LDAP != "" || c.Attrs.SAML != ""
}

func (c *CPAField) IsAdminManaged() bool {
	return c.Attrs.Managed == "admin"
}

// IsProtected returns whether the field is protected from modifications
func (c *CPAField) IsProtected() bool {
	return c.Attrs.Protected
}

// SetDefaults sets default values for CPAField attributes
func (c *CPAField) SetDefaults() {
	if c.Attrs.Visibility == "" {
		c.Attrs.Visibility = CustomProfileAttributesVisibilityDefault
	}
	if c.Attrs.AccessMode == "" {
		c.Attrs.AccessMode = CustomProfileAttributesAccessModePublic
	}
}

// Patch applies a PropertyFieldPatch to the CPAField by converting to PropertyField,
// applying the patch, and converting back. This ensures we only maintain one patch logic path.
// Custom profile attributes doesn't use targets, so TargetID and TargetType are cleared.
func (c *CPAField) Patch(patch *PropertyFieldPatch) error {
	// Custom profile attributes doesn't use targets
	patch.TargetID = nil
	patch.TargetType = nil

	// Convert to PropertyField
	pf := c.ToPropertyField()

	// Apply the patch using PropertyField's patch logic
	pf.Patch(patch)

	// Convert back to CPAField
	patched, err := NewCPAFieldFromPropertyField(pf)
	if err != nil {
		return err
	}

	// Update the current CPAField with patched values
	*c = *patched

	return nil
}

func (c *CPAField) ToPropertyField() *PropertyField {
	pf := c.PropertyField

	pf.Attrs = StringInterface{
		CustomProfileAttributesPropertyAttrsVisibility:     c.Attrs.Visibility,
		CustomProfileAttributesPropertyAttrsSortOrder:      c.Attrs.SortOrder,
		CustomProfileAttributesPropertyAttrsValueType:      c.Attrs.ValueType,
		PropertyFieldAttributeOptions:                      c.Attrs.Options,
		CustomProfileAttributesPropertyAttrsLDAP:           c.Attrs.LDAP,
		CustomProfileAttributesPropertyAttrsSAML:           c.Attrs.SAML,
		CustomProfileAttributesPropertyAttrsManaged:        c.Attrs.Managed,
		CustomProfileAttributesPropertyAttrsProtected:      c.Attrs.Protected,
		CustomProfileAttributesPropertyAttrsSourcePluginID: c.Attrs.SourcePluginID,
		CustomProfileAttributesPropertyAttrsAccessMode:     c.Attrs.AccessMode,
	}

	return &pf
}

// SupportsOptions checks the CPAField type and determines if the type
// supports the use of options
func (c *CPAField) SupportsOptions() bool {
	return c.Type == PropertyFieldTypeSelect || c.Type == PropertyFieldTypeMultiselect
}

// SupportsSyncing checks the CPAField type and determines if it
// supports syncing with external sources of truth
func (c *CPAField) SupportsSyncing() bool {
	return c.Type == PropertyFieldTypeText
}

func (c *CPAField) SanitizeAndValidate() *AppError {
	c.SetDefaults()

	// first we clean unused attributes depending on the field type
	if !c.SupportsOptions() {
		c.Attrs.Options = nil
	}
	if !c.SupportsSyncing() {
		c.Attrs.LDAP = ""
		c.Attrs.SAML = ""
	}

	// Clear sync properties if managed is set (mutual exclusivity)
	if c.IsAdminManaged() {
		c.Attrs.LDAP = ""
		c.Attrs.SAML = ""
	}

	switch c.Type {
	case PropertyFieldTypeText:
		if valueType := strings.TrimSpace(c.Attrs.ValueType); valueType != "" {
			if !IsKnownCPAValueType(valueType) {
				return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
					"AttributeName": CustomProfileAttributesPropertyAttrsValueType,
					"Reason":        "unknown value type",
				}, "", http.StatusUnprocessableEntity)
			}
			c.Attrs.ValueType = valueType
		}

	case PropertyFieldTypeSelect, PropertyFieldTypeMultiselect:
		options := c.Attrs.Options

		// add an ID to options with no ID
		for i := range options {
			if options[i].ID == "" {
				options[i].ID = NewId()
			}
		}

		if err := options.IsValid(); err != nil {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": PropertyFieldAttributeOptions,
				"Reason":        err.Error(),
			}, "", http.StatusUnprocessableEntity).Wrap(err)
		}
		c.Attrs.Options = options
	}

	// Validate visibility
	if visibilityAttr := strings.TrimSpace(c.Attrs.Visibility); visibilityAttr != "" {
		if !IsKnownCPAVisibility(visibilityAttr) {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": CustomProfileAttributesPropertyAttrsVisibility,
				"Reason":        "unknown visibility",
			}, "", http.StatusUnprocessableEntity)
		}
		c.Attrs.Visibility = visibilityAttr
	}

	// Validate managed field
	if managed := strings.TrimSpace(c.Attrs.Managed); managed != "" {
		if managed != "admin" {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": CustomProfileAttributesPropertyAttrsManaged,
				"Reason":        "unknown managed type",
			}, "", http.StatusBadRequest)
		}
		c.Attrs.Managed = managed
	}

	// Validate access_mode
	if accessMode := strings.TrimSpace(c.Attrs.AccessMode); accessMode != "" {
		if !IsKnownCPAAccessMode(accessMode) {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": CustomProfileAttributesPropertyAttrsAccessMode,
				"Reason":        "unknown access mode",
			}, "", http.StatusUnprocessableEntity)
		}
		c.Attrs.AccessMode = accessMode

		// Validate that shared_only is only used with select/multiselect types
		if accessMode == CustomProfileAttributesAccessModeSharedOnly && !c.SupportsOptions() {
			return NewAppError("SanitizeAndValidate", "app.custom_profile_attributes.sanitize_and_validate.app_error", map[string]any{
				"AttributeName": CustomProfileAttributesPropertyAttrsAccessMode,
				"Reason":        "shared_only access mode is only valid for select and multiselect field types",
			}, "", http.StatusUnprocessableEntity)
		}
	}

	return nil
}

// EnsureNoSourcePluginID validates that source_plugin_id is not set
func (c *CPAField) EnsureNoSourcePluginID() *AppError {
	if c.Attrs.SourcePluginID != "" {
		return NewAppError("EnsureNoSourcePluginID",
			"app.custom_profile_attributes.source_plugin_id_not_allowed.app_error",
			nil,
			"source_plugin_id can only be set via Plugin API",
			http.StatusBadRequest)
	}
	return nil
}

func (c *CPAField) CanModifyField(callerPluginID string) bool {
	return CanModifyPropertyField(&c.PropertyField, callerPluginID)
}

// CanModifyPropertyField checks if the given plugin can modify a PropertyField
func CanModifyPropertyField(field *PropertyField, callerPluginID string) bool {
	if field.Attrs == nil {
		return true
	}

	if protected, ok := field.Attrs[CustomProfileAttributesPropertyAttrsProtected].(bool); !ok || !protected {
		return true
	}

	// Field is protected - only the source plugin can modify
	sourcePluginID, _ := field.Attrs[CustomProfileAttributesPropertyAttrsSourcePluginID].(string)
	return sourcePluginID != "" && sourcePluginID == callerPluginID
}

// CanReadPropertyFieldWithoutRestrictions checks if the given caller can read a PropertyField
// without any restrictions (i.e., with full access to all options and values).
// Returns TRUE only for: public fields, or source_only/shared_only fields when the caller is the source plugin.
// Returns FALSE for source_only and shared_only fields when the caller is not the source plugin.
func CanReadPropertyFieldWithoutRestrictions(field *PropertyField, callerPluginID string) bool {
	if field.Attrs == nil {
		return true
	}

	accessMode, ok := field.Attrs[CustomProfileAttributesPropertyAttrsAccessMode].(string)
	if !ok || accessMode == "" || accessMode == CustomProfileAttributesAccessModePublic {
		return true
	}

	// For source_only and shared_only modes, only the source plugin has unrestricted access
	if accessMode == CustomProfileAttributesAccessModeSourceOnly || accessMode == CustomProfileAttributesAccessModeSharedOnly {
		sourcePluginID, _ := field.Attrs[CustomProfileAttributesPropertyAttrsSourcePluginID].(string)
		return sourcePluginID != "" && sourcePluginID == callerPluginID
	}

	return true
}

// extractOptionIDsFromValue parses a JSON value and extracts option IDs into a set.
// For select fields: returns a set with one option ID
// For multiselect fields: returns a set with multiple option IDs
// Returns nil if value is empty, or an error if field type is not select/multiselect.
func extractOptionIDsFromValue(fieldType PropertyFieldType, value json.RawMessage) (map[string]struct{}, error) {
	if len(value) == 0 {
		return nil, nil
	}

	optionIDs := make(map[string]struct{})

	switch fieldType {
	case PropertyFieldTypeSelect:
		var optionID string
		if err := json.Unmarshal(value, &optionID); err != nil {
			return nil, err
		}
		if optionID != "" {
			optionIDs[optionID] = struct{}{}
		}

	case PropertyFieldTypeMultiselect:
		var ids []string
		if err := json.Unmarshal(value, &ids); err != nil {
			return nil, err
		}
		for _, id := range ids {
			if id != "" {
				optionIDs[id] = struct{}{}
			}
		}

	default:
		return nil, fmt.Errorf("extractOptionIDsFromValue only supports select and multiselect field types, got: %s", fieldType)
	}

	return optionIDs, nil
}

// FilterSharedOnlyOptions filters a field's options to only include those associated with the caller.
// Returns a new slice of options containing only the caller's associated options.
// If callerValue is empty or invalid, returns an empty slice.
// Returns an error if field type is not select or multiselect.
func FilterSharedOnlyOptions(field *CPAField, callerValue json.RawMessage) ([]*CustomProfileAttributesSelectOption, error) {
	if field.Type != PropertyFieldTypeSelect && field.Type != PropertyFieldTypeMultiselect {
		return nil, fmt.Errorf("FilterSharedOnlyOptions only supports select and multiselect field types, got: %s", field.Type)
	}

	// Extract caller's associated option IDs
	callerOptionIDs, err := extractOptionIDsFromValue(field.Type, callerValue)
	if err != nil {
		return nil, err
	}
	if callerOptionIDs == nil {
		return []*CustomProfileAttributesSelectOption{}, nil
	}

	// Filter options to only include those the caller has associated
	filteredOptions := make([]*CustomProfileAttributesSelectOption, 0)
	for _, option := range field.Attrs.Options {
		if _, exists := callerOptionIDs[option.ID]; exists {
			filteredOptions = append(filteredOptions, option)
		}
	}

	return filteredOptions, nil
}

// FilterSharedOnlyValue computes the intersection of caller and target values for shared_only fields.
// Returns the filtered value, whether a value should be returned, and any error.
// For single-select: returns value only if both users have the same value.
// For multi-select: returns the intersection of arrays.
// If there's no match/intersection, returns (nil, false, nil) to indicate no value should be returned.
// Returns an error if field type is not select or multiselect.
func FilterSharedOnlyValue(field *CPAField, callerValue, targetValue json.RawMessage) (json.RawMessage, bool, error) {
	if field.Type != PropertyFieldTypeSelect && field.Type != PropertyFieldTypeMultiselect {
		return nil, false, fmt.Errorf("FilterSharedOnlyValue only supports select and multiselect field types, got: %s", field.Type)
	}

	// Extract option IDs from both values
	callerOptionIDs, err := extractOptionIDsFromValue(field.Type, callerValue)
	if err != nil {
		return nil, false, err
	}
	targetOptionIDs, err := extractOptionIDsFromValue(field.Type, targetValue)
	if err != nil {
		return nil, false, err
	}

	// If either is empty, no intersection
	if callerOptionIDs == nil || targetOptionIDs == nil {
		return nil, false, nil
	}

	// Find intersection
	intersection := make([]string, 0)
	for targetID := range targetOptionIDs {
		if _, exists := callerOptionIDs[targetID]; exists {
			intersection = append(intersection, targetID)
		}
	}

	// If there's no intersection, return nothing
	if len(intersection) == 0 {
		return nil, false, nil
	}

	// Format result based on field type
	switch field.Type {
	case PropertyFieldTypeSelect:
		// For single-select, return the single matching value
		result, err := json.Marshal(intersection[0])
		return result, true, err

	case PropertyFieldTypeMultiselect:
		// For multi-select, return the array of matching values
		result, err := json.Marshal(intersection)
		return result, true, err

	default:
		// Should never reach here due to check at function start
		return nil, false, fmt.Errorf("unexpected field type: %s", field.Type)
	}
}

func NewCPAFieldFromPropertyField(pf *PropertyField) (*CPAField, error) {
	attrsJSON, err := json.Marshal(pf.Attrs)
	if err != nil {
		return nil, err
	}

	var attrs CPAAttrs
	err = json.Unmarshal(attrsJSON, &attrs)
	if err != nil {
		return nil, err
	}

	cpaField := &CPAField{
		PropertyField: *pf,
		Attrs:         attrs,
	}

	cpaField.SetDefaults()

	return cpaField, nil
}

// SanitizeAndValidatePropertyValue validates and sanitizes the given
// property value based on the field type
func SanitizeAndValidatePropertyValue(cpaField *CPAField, rawValue json.RawMessage) (json.RawMessage, error) {
	fieldType := cpaField.Type

	// build a list of existing options so we can check later if the values exist
	optionsMap := map[string]struct{}{}
	for _, v := range cpaField.Attrs.Options {
		optionsMap[v.ID] = struct{}{}
	}

	switch fieldType {
	case PropertyFieldTypeText, PropertyFieldTypeDate, PropertyFieldTypeSelect, PropertyFieldTypeUser:
		var value string
		if err := json.Unmarshal(rawValue, &value); err != nil {
			return nil, err
		}
		value = strings.TrimSpace(value)

		if fieldType == PropertyFieldTypeText {
			if len(value) > CPAValueTypeTextMaxLength {
				return nil, fmt.Errorf("value too long")
			}

			if cpaField.Attrs.ValueType == CustomProfileAttributesValueTypeEmail && !IsValidEmail(value) {
				return nil, fmt.Errorf("invalid email")
			}

			if cpaField.Attrs.ValueType == CustomProfileAttributesValueTypeURL {
				_, err := url.Parse(value)
				if err != nil {
					return nil, fmt.Errorf("invalid url: %w", err)
				}
			}
		}

		if fieldType == PropertyFieldTypeSelect && value != "" {
			if _, ok := optionsMap[value]; !ok {
				return nil, fmt.Errorf("option \"%s\" does not exist", value)
			}
		}

		if fieldType == PropertyFieldTypeUser && value != "" && !IsValidId(value) {
			return nil, fmt.Errorf("invalid user id")
		}
		return json.Marshal(value)

	case PropertyFieldTypeMultiselect, PropertyFieldTypeMultiuser:
		var values []string
		if err := json.Unmarshal(rawValue, &values); err != nil {
			return nil, err
		}
		filteredValues := make([]string, 0, len(values))
		for _, v := range values {
			trimmed := strings.TrimSpace(v)
			if trimmed == "" {
				continue
			}
			if fieldType == PropertyFieldTypeMultiselect {
				if _, ok := optionsMap[v]; !ok {
					return nil, fmt.Errorf("option \"%s\" does not exist", v)
				}
			}

			if fieldType == PropertyFieldTypeMultiuser && !IsValidId(trimmed) {
				return nil, fmt.Errorf("invalid user id: %s", trimmed)
			}
			filteredValues = append(filteredValues, trimmed)
		}
		return json.Marshal(filteredValues)

	default:
		return nil, fmt.Errorf("unknown field type: %s", fieldType)
	}
}
