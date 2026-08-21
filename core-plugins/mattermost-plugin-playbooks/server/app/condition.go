// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	MaxConditionDepth        = 1    // Maximum nesting depth allowed for and/or conditions
	MaxConditionsPerPlaybook = 1000 // Maximum number of conditions per playbook
	CurrentConditionVersion  = 1    // Current version of condition expressions
)

// ConditionExpression interface for version-aware condition expressions
type ConditionExpression interface {
	Evaluate(propertyFields []PropertyField, propertyValues []PropertyValue) bool
	Sanitize()
	Validate(propertyFields []PropertyField) error
	ExtractPropertyIDs() (fieldIDs []string, optionsIDs []string)
	ToString(propertyFields []PropertyField) string
	Auditable() map[string]any
	SwapPropertyIDs(propertyMappings *PropertyCopyResult) error
}

type ConditionExprV1 struct {
	And []ConditionExprV1 `json:"and,omitempty"`
	Or  []ConditionExprV1 `json:"or,omitempty"`

	Is    *ComparisonCondition `json:"is,omitempty"`
	IsNot *ComparisonCondition `json:"isNot,omitempty"`
}

type ComparisonCondition struct {
	FieldID string          `json:"field_id"`
	Value   json.RawMessage `json:"value"`
}

// Evaluate checks if the condition matches the given property fields and values
func (c *ConditionExprV1) Evaluate(propertyFields []PropertyField, propertyValues []PropertyValue) bool {
	// fieldID -> PropertyField
	fieldMap := make(map[string]PropertyField)
	for _, field := range propertyFields {
		fieldMap[field.ID] = field
	}

	// fieldID -> PropertyValue
	valueMap := make(map[string]PropertyValue)
	for _, value := range propertyValues {
		valueMap[value.FieldID] = value
	}

	return c.evaluate(fieldMap, valueMap)
}

// Validate ensures the condition is structurally valid and references valid field options
func (c *ConditionExprV1) Validate(propertyFields []PropertyField) error {
	return c.validate(0, propertyFields)
}

// Sanitize trims whitespace from condition values
func (c *ConditionExprV1) Sanitize() {
	if c.And != nil {
		for i := range c.And {
			c.And[i].Sanitize()
		}
	}

	if c.Or != nil {
		for i := range c.Or {
			c.Or[i].Sanitize()
		}
	}

	if c.Is != nil {
		c.Is.Sanitize()
	}

	if c.IsNot != nil {
		c.IsNot.Sanitize()
	}
}

func (c *ConditionExprV1) evaluate(fieldMap map[string]PropertyField, valueMap map[string]PropertyValue) bool {
	if c.And != nil {
		for _, condition := range c.And {
			if !condition.evaluate(fieldMap, valueMap) {
				return false
			}
		}
		return true
	}

	if c.Or != nil {
		for _, condition := range c.Or {
			if condition.evaluate(fieldMap, valueMap) {
				return true
			}
		}
		return false
	}

	if c.Is != nil {
		field, fieldExists := fieldMap[c.Is.FieldID]
		if !fieldExists {
			return false
		}

		// Missing values are treated as empty and handled by is()
		value := valueMap[c.Is.FieldID]
		return is(field, value, c.Is.Value)
	}

	if c.IsNot != nil {
		field, fieldExists := fieldMap[c.IsNot.FieldID]
		if !fieldExists {
			return true
		}

		// Missing values are treated as empty and handled by isNot()
		value := valueMap[c.IsNot.FieldID]
		return isNot(field, value, c.IsNot.Value)
	}

	return true
}

func (c *ConditionExprV1) validate(currentDepth int, propertyFields []PropertyField) error {
	conditionCount := 0

	if c.And != nil {
		conditionCount++
		if len(c.And) == 0 {
			return errors.New("and condition must have at least one nested condition")
		}
		if currentDepth >= MaxConditionDepth {
			return fmt.Errorf("condition nesting depth exceeds maximum allowed (%d)", MaxConditionDepth)
		}
		for _, condition := range c.And {
			if err := condition.validate(currentDepth+1, propertyFields); err != nil {
				return err
			}
		}
	}

	if c.Or != nil {
		conditionCount++
		if len(c.Or) == 0 {
			return errors.New("or condition must have at least one nested condition")
		}
		if currentDepth >= MaxConditionDepth {
			return fmt.Errorf("condition nesting depth exceeds maximum allowed (%d)", MaxConditionDepth)
		}
		for _, condition := range c.Or {
			if err := condition.validate(currentDepth+1, propertyFields); err != nil {
				return err
			}
		}
	}

	if c.Is != nil {
		conditionCount++
		if err := c.Is.Validate(propertyFields); err != nil {
			return err
		}
	}

	if c.IsNot != nil {
		conditionCount++
		if err := c.IsNot.Validate(propertyFields); err != nil {
			return err
		}
	}

	if conditionCount == 0 {
		return errors.New("condition must have at least one operation (and, or, is, isNot)")
	}

	if conditionCount > 1 {
		return errors.New("condition can only have one operation (and, or, is, isNot)")
	}

	return nil
}

// Validate ensures the comparison condition has valid field references and option values
func (cc *ComparisonCondition) Validate(propertyFields []PropertyField) error {
	if cc.FieldID == "" {
		return errors.New("field_id cannot be empty")
	}

	// Find the field to validate against
	for _, field := range propertyFields {
		if field.ID == cc.FieldID {
			return cc.validateValueForFieldType(field)
		}
	}

	return nil
}

// Sanitize trims whitespace from the comparison value
func (cc *ComparisonCondition) Sanitize() {
	var stringValue string
	if err := json.Unmarshal(cc.Value, &stringValue); err == nil {
		trimmed := strings.TrimSpace(stringValue)
		sanitized, _ := json.Marshal(trimmed)
		cc.Value = sanitized
	}
}

// Auditable returns a map representation of the comparison condition for audit purposes
func (cc *ComparisonCondition) Auditable() map[string]any {
	return map[string]any{
		"field_id": cc.FieldID,
		"value":    cc.Value,
	}
}

func (cc *ComparisonCondition) validateValueForFieldType(field PropertyField) error {
	switch field.Type {
	case model.PropertyFieldTypeText:
		var stringValue string
		if err := json.Unmarshal(cc.Value, &stringValue); err != nil {
			return errors.New("text field condition value must be a string")
		}
		return nil

	case model.PropertyFieldTypeSelect:
		var arrayValue []string
		if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
			return errors.New("select field condition value must be an array")
		}
		if len(arrayValue) == 0 {
			return errors.New("select field condition value array cannot be empty")
		}

		if len(field.Attrs.Options) == 0 {
			return errors.New("condition value does not match any valid option for select field")
		}

		validOptionIDs := make(map[string]bool)
		for _, option := range field.Attrs.Options {
			validOptionIDs[option.GetID()] = true
		}

		for _, value := range arrayValue {
			if !validOptionIDs[value] {
				return errors.New("condition value does not match any valid option for select field")
			}
		}

		return nil

	case model.PropertyFieldTypeMultiselect:
		var arrayValue []string
		if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
			return errors.New("multiselect field condition value must be an array")
		}
		if len(arrayValue) == 0 {
			return errors.New("multiselect field condition value array cannot be empty")
		}

		if len(field.Attrs.Options) == 0 {
			return errors.New("condition value does not match any valid option for multiselect field")
		}

		validOptionIDs := make(map[string]bool)
		for _, option := range field.Attrs.Options {
			validOptionIDs[option.GetID()] = true
		}

		for _, value := range arrayValue {
			if !validOptionIDs[value] {
				return errors.New("condition value does not match any valid option for multiselect field")
			}
		}

		return nil

	default:
		return errors.New("unsupported field type for condition")
	}
}

// is checks if a property value matches the condition value based on the field type.
// For text fields: condition value is a string, performs case-insensitive comparison using strings.EqualFold.
// For select fields: condition value is an array, checks if the property value is any of the condition values.
// For multiselect fields: condition value is an array, checks if any condition value is in the property array.
func is(propertyField PropertyField, propertyValue PropertyValue, conditionValue json.RawMessage) bool {
	switch propertyField.Type {
	case model.PropertyFieldTypeText:
		var conditionString string
		if err := json.Unmarshal(conditionValue, &conditionString); err != nil {
			return false
		}

		var propertyString string
		if propertyValue.Value == nil {
			propertyString = ""
		} else if err := json.Unmarshal(propertyValue.Value, &propertyString); err != nil {
			return false
		}

		return strings.EqualFold(propertyString, conditionString)

	case model.PropertyFieldTypeSelect:
		var conditionArray []string
		if err := json.Unmarshal(conditionValue, &conditionArray); err != nil {
			return false
		}

		var propertyString string
		if err := json.Unmarshal(propertyValue.Value, &propertyString); err != nil {
			return false
		}

		return slices.Contains(conditionArray, propertyString)

	case model.PropertyFieldTypeMultiselect:
		var conditionArray []string
		if err := json.Unmarshal(conditionValue, &conditionArray); err != nil {
			return false
		}

		var propertyArray []string
		if err := json.Unmarshal(propertyValue.Value, &propertyArray); err != nil {
			return false
		}

		for _, conditionItem := range conditionArray {
			if slices.Contains(propertyArray, conditionItem) {
				return true
			}
		}
		return false

	default:
		return false
	}
}

// isNot checks if a property value does NOT match any of the condition values based on the field type.
// It returns the logical negation of the is function result.
func isNot(propertyField PropertyField, propertyValue PropertyValue, conditionValue json.RawMessage) bool {
	return !is(propertyField, propertyValue, conditionValue)
}

// ToString returns a human-readable string representation of the condition
func (c *ConditionExprV1) ToString(propertyFields []PropertyField) string {
	fieldMap := make(map[string]PropertyField)
	for _, field := range propertyFields {
		fieldMap[field.ID] = field
	}

	return c.toString(fieldMap, false)
}

// ExtractPropertyIDs returns all field IDs and options IDs used in this condition
func (c *ConditionExprV1) ExtractPropertyIDs() (fieldIDs []string, optionsIDs []string) {
	fieldIDSet := make(map[string]struct{})
	optionsIDSet := make(map[string]struct{})

	c.extractIDs(fieldIDSet, optionsIDSet)

	// Convert sets to slices
	for fieldID := range fieldIDSet {
		fieldIDs = append(fieldIDs, fieldID)
	}
	for optionsID := range optionsIDSet {
		optionsIDs = append(optionsIDs, optionsID)
	}

	return fieldIDs, optionsIDs
}

// Auditable returns a map representation of the condition expression for audit purposes
func (c *ConditionExprV1) Auditable() map[string]any {
	result := make(map[string]any)

	if c.And != nil {
		andConditions := make([]map[string]any, len(c.And))
		for i, condition := range c.And {
			andConditions[i] = condition.Auditable()
		}
		result["and"] = andConditions
	}

	if c.Or != nil {
		orConditions := make([]map[string]any, len(c.Or))
		for i, condition := range c.Or {
			orConditions[i] = condition.Auditable()
		}
		result["or"] = orConditions
	}

	if c.Is != nil {
		result["is"] = c.Is.Auditable()
	}

	if c.IsNot != nil {
		result["isNot"] = c.IsNot.Auditable()
	}

	return result
}

// SwapPropertyIDs translates field IDs in the condition expression
func (c *ConditionExprV1) SwapPropertyIDs(propertyMappings *PropertyCopyResult) error {
	// Handle And conditions
	for i := range c.And {
		if err := c.And[i].SwapPropertyIDs(propertyMappings); err != nil {
			return err
		}
	}

	// Handle Or conditions
	for i := range c.Or {
		if err := c.Or[i].SwapPropertyIDs(propertyMappings); err != nil {
			return err
		}
	}

	// Handle Is conditions
	if c.Is != nil {
		if err := c.Is.SwapPropertyIDs(propertyMappings); err != nil {
			return err
		}
	}

	// Handle IsNot conditions
	if c.IsNot != nil {
		if err := c.IsNot.SwapPropertyIDs(propertyMappings); err != nil {
			return err
		}
	}

	return nil
}

// extractIDs recursively extracts field and option IDs
func (c *ConditionExprV1) extractIDs(fieldIDSet map[string]struct{}, optionsIDSet map[string]struct{}) {
	if c.And != nil {
		for _, condition := range c.And {
			condition.extractIDs(fieldIDSet, optionsIDSet)
		}
	}

	if c.Or != nil {
		for _, condition := range c.Or {
			condition.extractIDs(fieldIDSet, optionsIDSet)
		}
	}

	if c.Is != nil {
		fieldIDSet[c.Is.FieldID] = struct{}{}
		c.Is.extractOptionsIDs(optionsIDSet)
	}

	if c.IsNot != nil {
		fieldIDSet[c.IsNot.FieldID] = struct{}{}
		c.IsNot.extractOptionsIDs(optionsIDSet)
	}
}

// SwapPropertyIDs translates field and option IDs in the comparison condition
func (cc *ComparisonCondition) SwapPropertyIDs(propertyMappings *PropertyCopyResult) error {
	// Find the new field ID
	newFieldID, exists := propertyMappings.FieldMappings[cc.FieldID]
	if !exists {
		return errors.Errorf("no field mapping found for field ID %s", cc.FieldID)
	}

	// Find the corresponding PropertyField to check its type
	var targetField *PropertyField
	for _, field := range propertyMappings.CopiedFields {
		if field.ID == newFieldID {
			targetField = &field
			break
		}
	}

	if targetField == nil {
		return errors.Errorf("could not find copied field info for new field ID %s", newFieldID)
	}

	// Update the field ID
	cc.FieldID = newFieldID

	// For select/multiselect fields, translate option IDs in the value
	switch targetField.Type {
	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect:
		var arrayValue []string
		if err := json.Unmarshal(cc.Value, &arrayValue); err == nil {
			// Successfully unmarshaled as array, translate option IDs
			translatedValues := make([]string, len(arrayValue))
			for i, optionID := range arrayValue {
				if newOptionID, exists := propertyMappings.OptionMappings[optionID]; exists {
					translatedValues[i] = newOptionID
				} else {
					// If no mapping exists, keep the original value
					translatedValues[i] = optionID
				}
			}

			// Marshal back to JSON
			newValue, err := json.Marshal(translatedValues)
			if err != nil {
				return errors.Wrap(err, "failed to marshal translated option values")
			}
			cc.Value = newValue
		}
	default:
		// For text and other field types, no option translation needed
	}

	return nil
}

// extractOptionsIDs extracts option IDs from a comparison condition
func (cc *ComparisonCondition) extractOptionsIDs(optionsIDSet map[string]struct{}) {
	var arrayValue []string
	if err := json.Unmarshal(cc.Value, &arrayValue); err == nil {
		// Successfully unmarshaled as array (select/multiselect fields)
		for _, optionID := range arrayValue {
			optionsIDSet[optionID] = struct{}{}
		}
	}
}

func (c *ConditionExprV1) toString(fieldMap map[string]PropertyField, needsParens bool) string {
	if c.And != nil {
		var parts []string
		for _, condition := range c.And {
			parts = append(parts, condition.toString(fieldMap, true))
		}
		if len(parts) == 1 {
			return parts[0]
		}
		result := strings.Join(parts, " AND ")
		if needsParens {
			return "(" + result + ")"
		}
		return result
	}

	if c.Or != nil {
		var parts []string
		for _, condition := range c.Or {
			parts = append(parts, condition.toString(fieldMap, true))
		}
		if len(parts) == 1 {
			return parts[0]
		}
		result := strings.Join(parts, " OR ")
		if needsParens {
			return "(" + result + ")"
		}
		return result
	}

	if c.Is != nil {
		return c.Is.toString(fieldMap, false)
	}

	if c.IsNot != nil {
		return c.IsNot.toString(fieldMap, true)
	}

	return ""
}

func (cc *ComparisonCondition) toString(fieldMap map[string]PropertyField, isNot bool) string {
	field, exists := fieldMap[cc.FieldID]
	var fieldName string
	if exists && field.Name != "" {
		fieldName = field.Name
	} else {
		fieldName = cc.FieldID
	}

	operator := "is"
	if isNot {
		operator = "is not"
	}

	valueStr := cc.formatValue(field, exists)
	return fmt.Sprintf(`"%s" %s %s`, fieldName, operator, valueStr)
}

func (cc *ComparisonCondition) formatValue(field PropertyField, fieldExists bool) string {
	if !fieldExists {
		return cc.formatUnknownFieldValue()
	}

	switch field.Type {
	case model.PropertyFieldTypeText:
		return cc.formatTextValue()
	case model.PropertyFieldTypeSelect:
		return cc.formatSelectValue(field)
	case model.PropertyFieldTypeMultiselect:
		return cc.formatMultiselectValue(field)
	}

	return ""
}

func (cc *ComparisonCondition) formatTextValue() string {
	var stringValue string
	if err := json.Unmarshal(cc.Value, &stringValue); err == nil {
		if stringValue == "" {
			return "empty"
		}
		return fmt.Sprintf(`"%s"`, stringValue)
	}
	return string(cc.Value)
}

func (cc *ComparisonCondition) formatSelectValue(field PropertyField) string {
	var arrayValue []string
	if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
		return string(cc.Value)
	}

	optionMap := make(map[string]string)
	for _, option := range field.Attrs.Options {
		optionMap[option.GetID()] = option.GetName()
	}

	var displayValues []string
	for _, value := range arrayValue {
		if name, ok := optionMap[value]; ok {
			displayValues = append(displayValues, name)
		} else {
			displayValues = append(displayValues, value)
		}
	}

	if len(displayValues) == 1 {
		return displayValues[0]
	}
	return "[" + strings.Join(displayValues, ",") + "]"
}

func (cc *ComparisonCondition) formatMultiselectValue(field PropertyField) string {
	var arrayValue []string
	if err := json.Unmarshal(cc.Value, &arrayValue); err != nil {
		return string(cc.Value)
	}

	optionMap := make(map[string]string)
	for _, option := range field.Attrs.Options {
		optionMap[option.GetID()] = option.GetName()
	}

	var displayValues []string
	for _, value := range arrayValue {
		if name, ok := optionMap[value]; ok {
			displayValues = append(displayValues, name)
		} else {
			displayValues = append(displayValues, value)
		}
	}

	if len(displayValues) == 1 {
		return displayValues[0]
	}
	return "[" + strings.Join(displayValues, ",") + "]"
}

func (cc *ComparisonCondition) formatUnknownFieldValue() string {
	var stringValue string
	if err := json.Unmarshal(cc.Value, &stringValue); err == nil {
		return stringValue
	}

	var arrayValue []string
	if err := json.Unmarshal(cc.Value, &arrayValue); err == nil {
		if len(arrayValue) == 1 {
			return arrayValue[0]
		}
		return "[" + strings.Join(arrayValue, ",") + "]"
	}

	return string(cc.Value)
}

// Condition represents a condition in the public API
type Condition struct {
	ID            string              `json:"id"`
	ConditionExpr ConditionExpression `json:"condition_expr"`
	Version       int                 `json:"version"`
	PlaybookID    string              `json:"playbook_id"`
	RunID         string              `json:"run_id,omitempty"`
	CreateAt      int64               `json:"create_at"`
	UpdateAt      int64               `json:"update_at"`
	DeleteAt      int64               `json:"delete_at"`
}

// IsValid validates a condition
func (c *Condition) IsValid(isCreation bool, propertyFields []PropertyField) error {
	if isCreation && c.ID != "" {
		return errors.New("condition ID should not be specified for creation")
	}

	if !isCreation && c.ID == "" {
		return errors.New("condition ID is required for updates")
	}

	if c.PlaybookID == "" {
		return errors.New("playbook ID is required")
	}

	// Run conditions are read-only - cannot be created, updated, or deleted via API
	if c.RunID != "" {
		if isCreation {
			return errors.New("run conditions cannot be created directly")
		} else {
			return errors.New("run conditions cannot be modified")
		}
	}

	// Validate the condition expression is not nil
	if c.ConditionExpr == nil {
		return errors.New("condition expression is required")
	}

	// Validate the condition expression structure
	if err := c.ConditionExpr.Validate(propertyFields); err != nil {
		return fmt.Errorf("invalid condition expression: %w", err)
	}

	return nil
}

func (c *Condition) Sanitize() {
	c.ConditionExpr.Sanitize()
}

// Auditable returns a map representation of the condition for audit purposes
func (c *Condition) Auditable() map[string]any {
	return map[string]any{
		"id":             c.ID,
		"version":        c.Version,
		"playbook_id":    c.PlaybookID,
		"run_id":         c.RunID,
		"create_at":      c.CreateAt,
		"update_at":      c.UpdateAt,
		"delete_at":      c.DeleteAt,
		"condition_expr": c.ConditionExpr.Auditable(),
	}
}

// GetConditionsResults contains the results of the GetConditions call
type GetConditionsResults struct {
	TotalCount int         `json:"total_count"`
	PageCount  int         `json:"page_count"`
	HasMore    bool        `json:"has_more"`
	Items      []Condition `json:"items"`
}

// ConditionService provides methods for managing stored conditions
type ConditionService interface {
	// Playbooks: RW
	GetPlaybookConditions(userID, playbookID string, page, perPage int) (*GetConditionsResults, error)
	GetPlaybookCondition(userID, playbookID, conditionID string) (*Condition, error)
	CreatePlaybookCondition(userID string, condition Condition, teamID string) (*Condition, error)
	UpdatePlaybookCondition(userID string, condition Condition, teamID string) (*Condition, error)
	DeletePlaybookCondition(userID, playbookID, conditionID string, teamID string) error

	// Runs: RO
	GetRunConditions(userID, playbookID, runID string, page, perPage int) (*GetConditionsResults, error)

	// Copy conditions from playbook to run with field ID mappings, returns old condition ID to new condition mapping
	CopyPlaybookConditionsToRun(playbookID, runID string, propertyMappings *PropertyCopyResult) (map[string]*Condition, error)

	// Evaluate conditions for a run when a property field changes
	EvaluateConditionsOnValueChanged(playbookRun *PlaybookRun, changedFieldID string) (*ConditionEvaluationResult, error)

	// Evaluate all conditions for a run (typically called on run creation)
	EvaluateAllConditionsForRun(playbookRun *PlaybookRun) (*ConditionEvaluationResult, error)
}

// ConditionStore defines database operations for stored conditions
type ConditionStore interface {
	CreateCondition(playbookID string, condition Condition) (*Condition, error)
	GetCondition(playbookID, conditionID string) (*Condition, error) // Internal use only for Update/Delete
	UpdateCondition(playbookID string, condition Condition) (*Condition, error)
	DeleteCondition(playbookID, conditionID string) error
	GetPlaybookConditions(playbookID string, page, perPage int) ([]Condition, error)
	GetRunConditions(playbookID, runID string, page, perPage int) ([]Condition, error)
	GetPlaybookConditionCount(playbookID string) (int, error)
	GetRunConditionCount(playbookID, runID string) (int, error)
	CountConditionsUsingPropertyField(playbookID, propertyFieldID string) (int, error)
	CountConditionsUsingPropertyOptions(playbookID string, propertyOptionIDs []string) (map[string]int, error)
	GetConditionsByRunAndFieldID(runID, fieldID string) ([]Condition, error)
}

type ConditionAction string

const (
	ConditionActionNone                 ConditionAction = ""
	ConditionActionHidden               ConditionAction = "hidden"
	ConditionActionShownBecauseModified ConditionAction = "shown_because_modified"
)

// ChecklistConditionChanges represents condition changes for a single checklist
type ChecklistConditionChanges struct {
	Added      int
	Hidden     int
	hasChanges bool
}

// ConditionEvaluationResult represents the result of evaluating conditions for a run
type ConditionEvaluationResult struct {
	// Changes per checklist, keyed by checklist title
	ChecklistChanges map[string]*ChecklistConditionChanges
}

// AnythingChanged returns true if any conditions resulted in visibility changes
func (r *ConditionEvaluationResult) AnythingChanged() bool {
	for _, changes := range r.ChecklistChanges {
		if changes.hasChanges {
			return true
		}
	}
	return false
}

// AnythingAdded returns true if any tasks were shown/added to checklists
func (r *ConditionEvaluationResult) AnythingAdded() bool {
	for _, changes := range r.ChecklistChanges {
		if changes.Added > 0 {
			return true
		}
	}
	return false
}
