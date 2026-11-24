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
	// SignalTextMaxRunes caps a text value in a signal payload.
	SignalTextMaxRunes = 128
	// SignalPayloadMaxBytes caps the JSON encoded signal payload.
	SignalPayloadMaxBytes = 16 * 1024
	// ActionTextMaxRunes caps a text value in an action request or result.
	ActionTextMaxRunes = 1024
	// ActionMaxBytes caps the JSON encoded action request or result.
	ActionMaxBytes = 1 << 20
)

var signalNamePattern = regexp.MustCompile(`^[a-z0-9_]{1,64}$`)

// IsValidSignalName reports whether name is a valid group, signal, action or field key: [a-z0-9_]{1,64}.
func IsValidSignalName(name string) bool {
	return signalNamePattern.MatchString(name)
}

// SignalValueType is the closed set of types a signal or action field may declare.
// An empty value means text.
type SignalValueType string

const (
	SignalTypeText     SignalValueType = "text"
	SignalTypeTextarea SignalValueType = "textarea"
	SignalTypeBool     SignalValueType = "bool"
	SignalTypeInt      SignalValueType = "int"
	SignalTypeFloat    SignalValueType = "float"
)

// Normalize treats an omitted type as text.
func (t SignalValueType) Normalize() SignalValueType {
	if t == "" {
		return SignalTypeText
	}
	return t
}

// IsKnown reports whether t is one of the five signal value types.
func (t SignalValueType) IsKnown() bool {
	switch t.Normalize() {
	case SignalTypeText, SignalTypeTextarea, SignalTypeBool, SignalTypeInt, SignalTypeFloat:
		return true
	default:
		return false
	}
}

// SignalValue is one typed field on a signal payload, an action request, or an action result.
// Type is the discriminator, so a false bool and a zero int are real values.
type SignalValue struct {
	Type  SignalValueType `json:"type"`
	Text  string          `json:"text,omitempty"`
	Bool  bool            `json:"bool,omitempty"`
	Int   int64           `json:"int,omitempty"`
	Float float64         `json:"float,omitempty"`
}

func SignalTextValue(value string) SignalValue {
	return SignalValue{Type: SignalTypeText, Text: value}
}

func SignalTextareaValue(value string) SignalValue {
	return SignalValue{Type: SignalTypeTextarea, Text: value}
}

func SignalBoolValue(value bool) SignalValue {
	return SignalValue{Type: SignalTypeBool, Bool: value}
}

func SignalIntValue(value int64) SignalValue {
	return SignalValue{Type: SignalTypeInt, Int: value}
}

func SignalFloatValue(value float64) SignalValue {
	return SignalValue{Type: SignalTypeFloat, Float: value}
}

// Native returns the value as a Go bool, int64, float64 or string.
func (v SignalValue) Native() any {
	switch v.Type.Normalize() {
	case SignalTypeBool:
		return v.Bool
	case SignalTypeInt:
		return v.Int
	case SignalTypeFloat:
		return v.Float
	default:
		return v.Text
	}
}

// Equal reports whether v and other hold the same typed value.
func (v SignalValue) Equal(other SignalValue) bool {
	if v.Type.Normalize() != other.Type.Normalize() {
		return false
	}
	return v.Native() == other.Native()
}

// Validate checks that v matches the declared type and the rune cap for text, and clears the
// members that don't belong to its type. allowTextarea is false for signals.
func (v *SignalValue) Validate(declared SignalValueType, textMaxRunes int, allowTextarea bool) error {
	if v == nil {
		return fmt.Errorf("value is missing")
	}
	want := declared.Normalize()
	got := v.Type.Normalize()
	if !want.IsKnown() || !got.IsKnown() || got != want {
		return fmt.Errorf("value type %q does not match declared type %q", v.Type, declared)
	}
	if want == SignalTypeTextarea && !allowTextarea {
		return fmt.Errorf("signals cannot carry textarea values")
	}

	v.Type = want
	switch want {
	case SignalTypeText, SignalTypeTextarea:
		v.Bool, v.Int, v.Float = false, 0, 0
		if want == SignalTypeText && utf8.RuneCountInString(v.Text) > textMaxRunes {
			return fmt.Errorf("text value exceeds %d characters", textMaxRunes)
		}
	case SignalTypeBool:
		if v.Text != "" {
			return fmt.Errorf("bool value must not carry text")
		}
		v.Int, v.Float = 0, 0
	case SignalTypeInt:
		if v.Text != "" {
			return fmt.Errorf("int value must not carry text")
		}
		v.Bool, v.Float = false, 0
	case SignalTypeFloat:
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

// SignalField is one key a signal payload, action input or action result declares.
type SignalField struct {
	Key         string          `json:"key"`
	Label       string          `json:"label"`
	Type        SignalValueType `json:"type,omitempty"`
	Description string          `json:"description,omitempty"`
}

// Free-form text keys are blocked in signal payloads so that message content can't leak to
// every subscriber.
var signalBlockedTextKeys = map[string]struct{}{
	"summary": {}, "details": {}, "message": {}, "title": {}, "text": {},
	"description": {}, "retrospective": {}, "task": {}, "username": {}, "email": {},
	"old_value": {}, "new_value": {}, "old_value_display": {}, "new_value_display": {},
}

var signalReservedKeys = map[string]struct{}{
	"pluginid": {}, "signal": {}, "steps": {}, "vars": {}, "secrets": {},
	"channelid": {}, "teamid": {}, "userid": {},
}

var signalIdentityKeys = map[string]struct{}{
	"user_id": {}, "team_id": {}, "channel_id": {}, "run_id": {}, "playbook_id": {},
	"page_id": {}, "post_id": {}, "item_id": {}, "comment_id": {}, "parent_id": {},
}

// IsSignalBlockedKey reports whether key is free-form text that signals can't carry.
func IsSignalBlockedKey(key string) bool {
	_, ok := signalBlockedTextKeys[strings.ToLower(key)]
	return ok
}

// IsSignalReservedKey reports whether key is reserved for the automation runtime.
func IsSignalReservedKey(key string) bool {
	_, ok := signalReservedKeys[strings.ToLower(key)]
	return ok
}

// IsSignalIdentityKey reports whether key names an entity ID, which signals must declare as text.
func IsSignalIdentityKey(key string) bool {
	_, ok := signalIdentityKeys[strings.ToLower(key)]
	return ok
}

// ValidateSignalFields checks the fields a signal declares and normalizes their types.
func ValidateSignalFields(fields []SignalField) error {
	seen := make(map[string]struct{}, len(fields))
	for i := range fields {
		field := &fields[i]
		if err := validateFieldKey(field.Key, seen, true); err != nil {
			return err
		}
		field.Type = field.Type.Normalize()
		if IsSignalBlockedKey(field.Key) {
			return fmt.Errorf("field %q is free-form text and is not allowed in signals", field.Key)
		}
		if IsSignalReservedKey(field.Key) {
			return fmt.Errorf("field %q is reserved", field.Key)
		}
		if !field.Type.IsKnown() || field.Type == SignalTypeTextarea {
			return fmt.Errorf("field %q has type %q, which signals do not allow", field.Key, field.Type)
		}
		if IsSignalIdentityKey(field.Key) && field.Type != SignalTypeText {
			return fmt.Errorf("field %q must be text", field.Key)
		}
	}
	return nil
}

// ValidateActionFields checks the input or result fields an action declares and normalizes
// their types.
func ValidateActionFields(fields []SignalField) error {
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
	if strict && !IsValidSignalName(key) {
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

// ValidateSignalPayload checks a payload against the declared signal fields and returns a
// normalized copy. Every key must be declared.
func ValidateSignalPayload(fields []SignalField, payload map[string]SignalValue) (map[string]SignalValue, error) {
	out, err := checkValues(fields, payload, SignalTextMaxRunes, false, false)
	if err != nil {
		return nil, err
	}
	if err := checkEncodedSize(out, SignalPayloadMaxBytes); err != nil {
		return nil, err
	}
	return out, nil
}

// ValidateActionInputs checks action inputs against the declared fields and returns a
// normalized copy. Every key must be declared.
func ValidateActionInputs(fields []SignalField, inputs map[string]SignalValue) (map[string]SignalValue, error) {
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
func FilterActionResults(fields []SignalField, results map[string]SignalValue) (map[string]SignalValue, error) {
	out, err := checkValues(fields, results, ActionTextMaxRunes, true, true)
	if err != nil {
		return nil, err
	}
	if err := checkEncodedSize(out, ActionMaxBytes); err != nil {
		return nil, err
	}
	return out, nil
}

func checkValues(fields []SignalField, values map[string]SignalValue, textMaxRunes int, allowTextarea, dropUndeclared bool) (map[string]SignalValue, error) {
	declared := make(map[string]SignalValueType, len(fields))
	for _, field := range fields {
		declared[field.Key] = field.Type
	}
	out := make(map[string]SignalValue, len(values))
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

func checkEncodedSize(values map[string]SignalValue, maxBytes int) error {
	encoded, err := json.Marshal(values)
	if err != nil {
		return err
	}
	if len(encoded) > maxBytes {
		return fmt.Errorf("encoded size %d exceeds %d bytes", len(encoded), maxBytes)
	}
	return nil
}
