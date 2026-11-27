// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	// EventTextMaxRunes caps a text value in an event payload.
	EventTextMaxRunes = 128
	// EventPayloadMaxBytes caps the JSON encoded event payload.
	EventPayloadMaxBytes = 16 * 1024
	// ActionTextMaxRunes caps a text value in an action request or result.
	ActionTextMaxRunes = 1024
	// ActionMaxBytes caps the JSON encoded action request or result.
	ActionMaxBytes = 1 << 20
)

var eventNamePattern = regexp.MustCompile(`^[a-z0-9_]{1,64}$`)

// IsValidEventName reports whether name is a valid group, event, action or field key: [a-z0-9_]{1,64}.
func IsValidEventName(name string) bool {
	return eventNamePattern.MatchString(name)
}

// EventValueType is the closed set of types an event or action field may declare.
// An empty value means text.
type EventValueType string

const (
	EventTypeText     EventValueType = "text"
	EventTypeTextarea EventValueType = "textarea"
	EventTypeBool     EventValueType = "bool"
	EventTypeInt      EventValueType = "int"
	EventTypeFloat    EventValueType = "float"
)

// Normalize treats an omitted type as text.
func (t EventValueType) Normalize() EventValueType {
	if t == "" {
		return EventTypeText
	}
	return t
}

// IsKnown reports whether t is one of the five event value types.
func (t EventValueType) IsKnown() bool {
	switch t.Normalize() {
	case EventTypeText, EventTypeTextarea, EventTypeBool, EventTypeInt, EventTypeFloat:
		return true
	default:
		return false
	}
}

// EventValue is one typed field on an event payload, an action request, or an action result.
// Type is the discriminator, so a false bool and a zero int are real values.
type EventValue struct {
	Type  EventValueType `json:"type"`
	Text  string         `json:"text,omitempty"`
	Bool  bool           `json:"bool,omitempty"`
	Int   int64          `json:"int,omitempty"`
	Float float64        `json:"float,omitempty"`
}

func EventTextValue(value string) EventValue {
	return EventValue{Type: EventTypeText, Text: value}
}

func EventTextareaValue(value string) EventValue {
	return EventValue{Type: EventTypeTextarea, Text: value}
}

func EventBoolValue(value bool) EventValue {
	return EventValue{Type: EventTypeBool, Bool: value}
}

func EventIntValue(value int64) EventValue {
	return EventValue{Type: EventTypeInt, Int: value}
}

func EventFloatValue(value float64) EventValue {
	return EventValue{Type: EventTypeFloat, Float: value}
}

// Native returns the value as a Go bool, int64, float64 or string.
func (v EventValue) Native() any {
	switch v.Type.Normalize() {
	case EventTypeBool:
		return v.Bool
	case EventTypeInt:
		return v.Int
	case EventTypeFloat:
		return v.Float
	default:
		return v.Text
	}
}

// Equal reports whether v and other hold the same typed value.
func (v EventValue) Equal(other EventValue) bool {
	if v.Type.Normalize() != other.Type.Normalize() {
		return false
	}
	return v.Native() == other.Native()
}

// Validate checks that v matches the declared type and the rune cap for text, and clears the
// members that don't belong to its type. allowTextarea is false for events.
func (v *EventValue) Validate(declared EventValueType, textMaxRunes int, allowTextarea bool) error {
	if v == nil {
		return fmt.Errorf("value is missing")
	}
	want := declared.Normalize()
	got := v.Type.Normalize()
	if !want.IsKnown() || !got.IsKnown() || got != want {
		return fmt.Errorf("value type %q does not match declared type %q", v.Type, declared)
	}
	if want == EventTypeTextarea && !allowTextarea {
		return fmt.Errorf("events cannot carry textarea values")
	}

	v.Type = want
	switch want {
	case EventTypeText, EventTypeTextarea:
		v.Bool, v.Int, v.Float = false, 0, 0
		if want == EventTypeText && utf8.RuneCountInString(v.Text) > textMaxRunes {
			return fmt.Errorf("text value exceeds %d characters", textMaxRunes)
		}
	case EventTypeBool:
		if v.Text != "" {
			return fmt.Errorf("bool value must not carry text")
		}
		v.Int, v.Float = 0, 0
	case EventTypeInt:
		if v.Text != "" {
			return fmt.Errorf("int value must not carry text")
		}
		v.Bool, v.Float = false, 0
	case EventTypeFloat:
		if v.Text != "" {
			return fmt.Errorf("float value must not carry text")
		}
		if math.IsNaN(v.Float) || math.IsInf(v.Float, 0) {
			return fmt.Errorf("float value must be finite")
		}
		v.Bool, v.Int = false, 0
	}
	return nil
}

// EventField is one key an event payload, action input or action result declares.
type EventField struct {
	Key         string         `json:"key"`
	Label       string         `json:"label"`
	Type        EventValueType `json:"type,omitempty"`
	Description string         `json:"description,omitempty"`
}

// Free-form text keys are blocked in event payloads so that message content can't leak to
// every subscriber.
var eventBlockedTextKeys = map[string]struct{}{
	"summary": {}, "details": {}, "message": {}, "title": {}, "text": {},
	"description": {}, "retrospective": {}, "task": {}, "username": {}, "email": {},
	"old_value": {}, "new_value": {}, "old_value_display": {}, "new_value_display": {},
}

var eventReservedKeys = map[string]struct{}{
	"pluginid": {}, "event": {}, "steps": {}, "vars": {}, "secrets": {},
	"channelid": {}, "teamid": {}, "userid": {},
}

var eventIdentityKeys = map[string]struct{}{
	"user_id": {}, "team_id": {}, "channel_id": {}, "run_id": {}, "playbook_id": {},
	"page_id": {}, "post_id": {}, "item_id": {}, "comment_id": {}, "parent_id": {},
}

// IsEventBlockedKey reports whether key is free-form text that events can't carry.
func IsEventBlockedKey(key string) bool {
	_, ok := eventBlockedTextKeys[strings.ToLower(key)]
	return ok
}

// IsEventReservedKey reports whether key is reserved for the automation runtime.
func IsEventReservedKey(key string) bool {
	_, ok := eventReservedKeys[strings.ToLower(key)]
	return ok
}

// IsEventIdentityKey reports whether key names an entity ID, which events must declare as text.
func IsEventIdentityKey(key string) bool {
	_, ok := eventIdentityKeys[strings.ToLower(key)]
	return ok
}

// ValidateEventFields checks the fields an event declares and normalizes their types.
func ValidateEventFields(fields []EventField) error {
	seen := make(map[string]struct{}, len(fields))
	for i := range fields {
		field := &fields[i]
		if err := validateFieldKey(field.Key, seen, true); err != nil {
			return err
		}
		field.Type = field.Type.Normalize()
		if IsEventBlockedKey(field.Key) {
			return fmt.Errorf("field %q is free-form text and is not allowed in events", field.Key)
		}
		if IsEventReservedKey(field.Key) {
			return fmt.Errorf("field %q is reserved", field.Key)
		}
		if !field.Type.IsKnown() || field.Type == EventTypeTextarea {
			return fmt.Errorf("field %q has type %q, which events do not allow", field.Key, field.Type)
		}
		if IsEventIdentityKey(field.Key) && field.Type != EventTypeText {
			return fmt.Errorf("field %q must be text", field.Key)
		}
	}
	return nil
}

// ValidateActionFields checks the input or result fields an action declares and normalizes
// their types.
func ValidateActionFields(fields []EventField) error {
	seen := make(map[string]struct{}, len(fields))
	for i := range fields {
		field := &fields[i]
		if err := validateFieldKey(field.Key, seen, false); err != nil {
			return err
		}
		field.Type = field.Type.Normalize()
		if !field.Type.IsKnown() {
			return fmt.Errorf("field %q has unknown type %q", field.Key, field.Type)
		}
	}
	return nil
}

func validateFieldKey(key string, seen map[string]struct{}, strict bool) error {
	if strict && !IsValidEventName(key) {
		return fmt.Errorf("field key %q must match [a-z0-9_]{1,64}", key)
	}
	if strings.TrimSpace(key) == "" {
		return fmt.Errorf("field key is required")
	}
	if _, dup := seen[key]; dup {
		return fmt.Errorf("field %q is declared twice", key)
	}
	seen[key] = struct{}{}
	return nil
}

// ValidateEventPayload checks a payload against the declared event fields and returns a
// normalized copy. Every key must be declared.
func ValidateEventPayload(fields []EventField, payload map[string]EventValue) (map[string]EventValue, error) {
	out, err := checkValues(fields, payload, EventTextMaxRunes, false, false)
	if err != nil {
		return nil, err
	}
	if err := checkEncodedSize(out, EventPayloadMaxBytes); err != nil {
		return nil, err
	}
	return out, nil
}

// ValidateActionInputs checks action inputs against the declared fields and returns a
// normalized copy. Every key must be declared.
func ValidateActionInputs(fields []EventField, inputs map[string]EventValue) (map[string]EventValue, error) {
	out, err := checkValues(fields, inputs, ActionTextMaxRunes, true, false)
	if err != nil {
		return nil, err
	}
	if err := checkEncodedSize(out, ActionMaxBytes); err != nil {
		return nil, err
	}
	return out, nil
}

// FilterActionResults keeps only the declared result fields and returns a normalized copy.
// Undeclared keys are dropped silently.
func FilterActionResults(fields []EventField, results map[string]EventValue) (map[string]EventValue, error) {
	out, err := checkValues(fields, results, ActionTextMaxRunes, true, true)
	if err != nil {
		return nil, err
	}
	if err := checkEncodedSize(out, ActionMaxBytes); err != nil {
		return nil, err
	}
	return out, nil
}

func checkValues(fields []EventField, values map[string]EventValue, textMaxRunes int, allowTextarea, dropUndeclared bool) (map[string]EventValue, error) {
	declared := make(map[string]EventValueType, len(fields))
	for _, field := range fields {
		declared[field.Key] = field.Type
	}
	out := make(map[string]EventValue, len(values))
	for key, value := range values {
		fieldType, ok := declared[key]
		if !ok {
			if dropUndeclared {
				continue
			}
			return nil, fmt.Errorf("field %q is not declared", key)
		}
		if err := value.Validate(fieldType, textMaxRunes, allowTextarea); err != nil {
			return nil, fmt.Errorf("field %q: %w", key, err)
		}
		out[key] = value
	}
	return out, nil
}

func checkEncodedSize(values map[string]EventValue, maxBytes int) error {
	encoded, err := json.Marshal(values)
	if err != nil {
		return err
	}
	if len(encoded) > maxBytes {
		return fmt.Errorf("encoded size %d exceeds %d bytes", len(encoded), maxBytes)
	}
	return nil
}
