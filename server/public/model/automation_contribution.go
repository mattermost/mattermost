// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"math"
	"unicode/utf8"

	"github.com/pkg/errors"
)

// MaxAutomationHops is how many automation runs one causal chain may traverse.
// The first run is hop zero. A signal that returns at this value is refused.
const MaxAutomationHops = 8

// AutomationActionMaxBytes is the encoded size limit for an action request or result.
const AutomationActionMaxBytes = 1 << 20

// AutomationActionTextMaxRunes is the cap for an action field of type text.
const AutomationActionTextMaxRunes = 1024

// AutomationSignalTextMaxRunes is the cap for a signal field of type text.
const AutomationSignalTextMaxRunes = 128

// AutomationValueType is the closed set of types an automation field may declare.
// An empty value means text. JSON keeps these words; this is not an integer enum.
type AutomationValueType string

const (
	AutomationValueText     AutomationValueType = "text"
	AutomationValueTextarea AutomationValueType = "textarea"
	AutomationValueBool     AutomationValueType = "bool"
	AutomationValueInt      AutomationValueType = "int"
	AutomationValueFloat    AutomationValueType = "float"
)

// Normalize treats an omitted type as text.
func (t AutomationValueType) Normalize() AutomationValueType {
	if t == "" {
		return AutomationValueText
	}
	return t
}

// IsKnown reports whether t is one of the five automation value types.
func (t AutomationValueType) IsKnown() bool {
	switch t.Normalize() {
	case AutomationValueText, AutomationValueTextarea, AutomationValueBool, AutomationValueInt, AutomationValueFloat:
		return true
	default:
		return false
	}
}

// AutomationValue is one typed field on a signal payload, an action request, or an action result.
// Type is the discriminator, so a false bool and a zero int are real values.
type AutomationValue struct {
	Type  AutomationValueType `json:"type"`
	Text  string              `json:"text,omitempty"`
	Bool  bool                `json:"bool,omitempty"`
	Int   int64               `json:"int,omitempty"`
	Float float64             `json:"float,omitempty"`
}

// AutomationText builds a text value.
func AutomationText(value string) AutomationValue {
	return AutomationValue{Type: AutomationValueText, Text: value}
}

// AutomationBool builds a bool value.
func AutomationBool(value bool) AutomationValue {
	return AutomationValue{Type: AutomationValueBool, Bool: value}
}

// AutomationInt builds an int value.
func AutomationInt(value int64) AutomationValue {
	return AutomationValue{Type: AutomationValueInt, Int: value}
}

// Native returns the Go value templates and step outputs store.
func (v AutomationValue) Native() any {
	switch v.Type.Normalize() {
	case AutomationValueBool:
		return v.Bool
	case AutomationValueInt:
		return v.Int
	case AutomationValueFloat:
		return v.Float
	default:
		return v.Text
	}
}

// Validate checks that v matches the declared type and the rune cap for text.
// allowTextarea is false for signals. A bool, int, or float must not carry Text.
func (v *AutomationValue) Validate(declared AutomationValueType, textMaxRunes int, allowTextarea bool) error {
	if v == nil {
		return errors.New("automation value is missing")
	}
	want := declared.Normalize()
	got := v.Type.Normalize()
	if !want.IsKnown() || !got.IsKnown() || got != want {
		return errors.Errorf("automation value type %q does not match declared type %q", v.Type, declared)
	}
	if want == AutomationValueTextarea && !allowTextarea {
		return errors.New("automation signals cannot carry textarea")
	}
	switch want {
	case AutomationValueText, AutomationValueTextarea:
		v.Type = want
		v.Bool = false
		v.Int = 0
		v.Float = 0
		if want == AutomationValueText && utf8.RuneCountInString(v.Text) > textMaxRunes {
			return errors.New("automation text value is too long")
		}
	case AutomationValueBool:
		if v.Text != "" {
			return errors.New("automation bool value must not carry text")
		}
		v.Type = want
		v.Int = 0
		v.Float = 0
	case AutomationValueInt:
		if v.Text != "" {
			return errors.New("automation int value must not carry text")
		}
		v.Type = want
		v.Bool = false
		v.Float = 0
	case AutomationValueFloat:
		if v.Text != "" {
			return errors.New("automation float value must not carry text")
		}
		if math.IsNaN(v.Float) || math.IsInf(v.Float, 0) {
			return errors.New("automation float value must be finite")
		}
		v.Type = want
		v.Bool = false
		v.Int = 0
	}
	return nil
}

// AutomationField is one input or output a contributed signal or action declares.
type AutomationField struct {
	Key   string              `json:"key"`
	Label string              `json:"label"`
	Type  AutomationValueType `json:"type,omitempty"`
}

// AutomationGroupDescriptor is a palette heading that holds a plugin's signals and actions.
type AutomationGroupDescriptor struct {
	PluginID string `json:"plugin_id,omitempty"`
	Label    string `json:"label"`
	Icon     string `json:"icon,omitempty"`
	IconURL  string `json:"icon_url,omitempty"`
}

// AutomationSignalDescriptor is a trigger a plugin can emit.
type AutomationSignalDescriptor struct {
	PluginID    string            `json:"plugin_id,omitempty"`
	Name        string            `json:"name"`
	Label       string            `json:"label"`
	Description string            `json:"description,omitempty"`
	Group       string            `json:"group,omitempty"`
	Icon        string            `json:"icon,omitempty"`
	Fields      []AutomationField `json:"fields,omitempty"`
}

// AutomationActionDescriptor is a palette action. Execution calls Method and Path
// on the plugin that registered it. Path may contain {{.field_key}} placeholders.
type AutomationActionDescriptor struct {
	PluginID    string            `json:"plugin_id,omitempty"`
	Type        string            `json:"type"`
	Label       string            `json:"label"`
	Description string            `json:"description,omitempty"`
	Group       string            `json:"group,omitempty"`
	Icon        string            `json:"icon,omitempty"`
	Method      string            `json:"method,omitempty"`
	Path        string            `json:"path,omitempty"`
	Fields      []AutomationField `json:"fields,omitempty"`
	Results     []AutomationField `json:"results,omitempty"`
	// Emits lists the signal names this action can emit. Weave records one hop key per name.
	Emits []string `json:"emits,omitempty"`
}

// AutomationSignalEvent is delivered to OnAutomationSignal.
type AutomationSignalEvent struct {
	PluginID   string                     `json:"plugin_id"`
	Signal     string                     `json:"signal"`
	Payload    map[string]AutomationValue `json:"payload,omitempty"`
	Hop        int                        `json:"hop"`
	TraceToken string                     `json:"trace_token,omitempty"`
	// TraceID is the stable chain id. It stays the same as the hop advances.
	TraceID string `json:"trace_id,omitempty"`
}

// AutomationActionRequest is the call that runs one registered action over plugin HTTP.
// PluginID is the plugin that registered the action. The server sets Mattermost-Plugin-ID
// from the RPC caller and does not trust CallerPluginID.
// TraceToken continues a chain the server already issued. The target reads
// Mattermost-Weave-Trace-Token and passes that value to EmitAutomationSignal.
type AutomationActionRequest struct {
	PluginID       string                     `json:"plugin_id"`
	Action         string                     `json:"action"`
	Fields         map[string]AutomationValue `json:"fields,omitempty"`
	OwnerScope     string                     `json:"owner_scope"`
	RunAs          string                     `json:"run_as"`
	AuthorUserID   string                     `json:"author_user_id"`
	InvokerUserID  string                     `json:"invoker_user_id"`
	ActingUserID   string                     `json:"acting_user_id"`
	CallerPluginID string                     `json:"caller_plugin_id"`
	TraceToken     string                     `json:"trace_token,omitempty"`
}

// AutomationActionResponse is the declared result fields taken from the HTTP JSON body.
type AutomationActionResponse struct {
	Fields map[string]AutomationValue `json:"fields,omitempty"`
}
