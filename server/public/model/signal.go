// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"slices"
	"strings"
)

// MaxSignalSubscriptions caps the subscriptions one plugin may hold.
const MaxSignalSubscriptions = 256

// SignalBusError is an error from the plugin signal bus. Its ID is stable across the plugin RPC
// boundary, so errors.Is matches a sentinel even when Message carries details.
type SignalBusError struct {
	ID      string
	Message string
}

func (e *SignalBusError) Error() string {
	return e.Message
}

func (e *SignalBusError) Is(target error) bool {
	t, ok := target.(*SignalBusError)
	return ok && t.ID == e.ID
}

// Wrapf returns a copy of e with details appended to its message.
func (e *SignalBusError) Wrapf(format string, args ...any) *SignalBusError {
	return &SignalBusError{ID: e.ID, Message: e.Message + ": " + fmt.Sprintf(format, args...)}
}

var (
	ErrSignalBusDisabled         = &SignalBusError{ID: "signal_bus.disabled", Message: "the plugin signal bus is disabled"}
	ErrSignalNotRegistered       = &SignalBusError{ID: "signal_bus.signal_not_registered", Message: "signal is not registered"}
	ErrSignalGroupNotRegistered  = &SignalBusError{ID: "signal_bus.group_not_registered", Message: "signal group is not registered"}
	ErrSignalDescriptorInvalid   = &SignalBusError{ID: "signal_bus.descriptor_invalid", Message: "descriptor is invalid"}
	ErrSignalSubscriptionInvalid = &SignalBusError{ID: "signal_bus.subscription_invalid", Message: "subscriptions are invalid"}
	ErrSignalPayloadInvalid      = &SignalBusError{ID: "signal_bus.payload_invalid", Message: "signal payload is invalid"}
	ErrSubscriberHookMissing     = &SignalBusError{ID: "signal_bus.subscriber_hook_missing", Message: "plugin does not implement OnSignal"}
	ErrActionHookMissing         = &SignalBusError{ID: "signal_bus.action_hook_missing", Message: "plugin does not implement OnActionCall"}
	ErrActionNotFound            = &SignalBusError{ID: "signal_bus.action_not_found", Message: "action is not registered"}
	ErrActionCallerNotAllowed    = &SignalBusError{ID: "signal_bus.action_caller_not_allowed", Message: "plugin is not allowed to call this action"}
	ErrActionFieldsInvalid       = &SignalBusError{ID: "signal_bus.action_fields_invalid", Message: "action fields are invalid"}
	ErrActionResultInvalid       = &SignalBusError{ID: "signal_bus.action_result_invalid", Message: "action result is invalid"}
	ErrActionCallFailed          = &SignalBusError{ID: "signal_bus.action_call_failed", Message: "action call failed"}
	ErrActingUserRequired        = &SignalBusError{ID: "signal_bus.acting_user_required", Message: "an acting user is required"}
	ErrActingUserInvalid         = &SignalBusError{ID: "signal_bus.acting_user_invalid", Message: "acting user does not exist or is inactive"}
	ErrPluginNotActive           = &SignalBusError{ID: "signal_bus.plugin_not_active", Message: "plugin is not active"}
)

// SignalGroup is a palette heading that holds a publisher's signals and actions.
type SignalGroup struct {
	PublisherID string `json:"publisher_id"`
	Name        string `json:"name"`
	Label       string `json:"label"`
	Icon        string `json:"icon,omitempty"`
}

func (g *SignalGroup) IsValid() error {
	if !IsValidSignalName(g.Name) {
		return ErrSignalDescriptorInvalid.Wrapf("group name %q must match [a-z0-9_]{1,64}", g.Name)
	}
	if strings.TrimSpace(g.Label) == "" {
		return ErrSignalDescriptorInvalid.Wrapf("group %q requires a label", g.Name)
	}
	return nil
}

type SignalVisibility string

const (
	SignalVisibilityAny       SignalVisibility = "any"
	SignalVisibilityAllowlist SignalVisibility = "allowlist"
)

// SignalDescriptor is a signal a publisher can emit. Its full name is publisher/name.
type SignalDescriptor struct {
	PublisherID string `json:"publisher_id"`
	Name        string `json:"name"`
	Group       string `json:"group,omitempty"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
	// Version starts at 1. Only additive changes are allowed within a version.
	Version            int              `json:"version"`
	Fields             []SignalField    `json:"fields"`
	Visibility         SignalVisibility `json:"visibility"`
	AllowedSubscribers []string         `json:"allowed_subscribers,omitempty"`
}

// FullName returns publisher/name.
func (d *SignalDescriptor) FullName() string {
	return d.PublisherID + "/" + d.Name
}

// IsVisibleTo reports whether subscriberID may receive this signal.
func (d *SignalDescriptor) IsVisibleTo(subscriberID string) bool {
	return d.Visibility != SignalVisibilityAllowlist || slices.Contains(d.AllowedSubscribers, subscriberID)
}

// Validate checks the descriptor and normalizes its visibility and field types.
func (d *SignalDescriptor) Validate() error {
	if !IsValidSignalName(d.Name) {
		return ErrSignalDescriptorInvalid.Wrapf("signal name %q must match [a-z0-9_]{1,64}", d.Name)
	}
	if d.Group != "" && !IsValidSignalName(d.Group) {
		return ErrSignalDescriptorInvalid.Wrapf("signal %q has invalid group %q", d.Name, d.Group)
	}
	if strings.TrimSpace(d.Label) == "" {
		return ErrSignalDescriptorInvalid.Wrapf("signal %q requires a label", d.Name)
	}
	if d.Version < 1 {
		return ErrSignalDescriptorInvalid.Wrapf("signal %q version must be at least 1", d.Name)
	}
	switch d.Visibility {
	case "":
		d.Visibility = SignalVisibilityAny
	case SignalVisibilityAny, SignalVisibilityAllowlist:
	default:
		return ErrSignalDescriptorInvalid.Wrapf("signal %q has unknown visibility %q", d.Name, d.Visibility)
	}
	for _, id := range d.AllowedSubscribers {
		if !IsValidPluginId(id) {
			return ErrSignalDescriptorInvalid.Wrapf("signal %q allows invalid subscriber %q", d.Name, id)
		}
	}
	if err := ValidateSignalFields(d.Fields); err != nil {
		return ErrSignalDescriptorInvalid.Wrapf("signal %q: %v", d.Name, err)
	}
	return nil
}

// ActionDescriptor is an action other plugins can call through OnActionCall.
type ActionDescriptor struct {
	PublisherID string        `json:"publisher_id"`
	Type        string        `json:"type"`
	Group       string        `json:"group,omitempty"`
	Label       string        `json:"label"`
	Description string        `json:"description,omitempty"`
	Fields      []SignalField `json:"fields"`
	Results     []SignalField `json:"results"`
	// Emits lists the signal names the action can emit. It is informational.
	Emits []string `json:"emits,omitempty"`
	// AllowedCallers restricts which plugins may call the action. Empty means any plugin.
	AllowedCallers []string `json:"allowed_callers,omitempty"`
	TimeoutSeconds int      `json:"timeout_seconds,omitempty"`
}

// IsCallerAllowed reports whether callerID may call this action.
func (d *ActionDescriptor) IsCallerAllowed(callerID string) bool {
	return len(d.AllowedCallers) == 0 || slices.Contains(d.AllowedCallers, callerID)
}

// Validate checks the descriptor and normalizes its field types.
func (d *ActionDescriptor) Validate() error {
	if !IsValidSignalName(d.Type) {
		return ErrSignalDescriptorInvalid.Wrapf("action type %q must match [a-z0-9_]{1,64}", d.Type)
	}
	if d.Group != "" && !IsValidSignalName(d.Group) {
		return ErrSignalDescriptorInvalid.Wrapf("action %q has invalid group %q", d.Type, d.Group)
	}
	if strings.TrimSpace(d.Label) == "" {
		return ErrSignalDescriptorInvalid.Wrapf("action %q requires a label", d.Type)
	}
	if d.TimeoutSeconds < 0 {
		return ErrSignalDescriptorInvalid.Wrapf("action %q timeout must not be negative", d.Type)
	}
	for _, name := range d.Emits {
		if !IsValidSignalName(name) {
			return ErrSignalDescriptorInvalid.Wrapf("action %q emits invalid signal name %q", d.Type, name)
		}
	}
	for _, id := range d.AllowedCallers {
		if !IsValidPluginId(id) {
			return ErrSignalDescriptorInvalid.Wrapf("action %q allows invalid caller %q", d.Type, id)
		}
	}
	if err := ValidateActionFields(d.Fields); err != nil {
		return ErrSignalDescriptorInvalid.Wrapf("action %q fields: %v", d.Type, err)
	}
	if err := ValidateActionFields(d.Results); err != nil {
		return ErrSignalDescriptorInvalid.Wrapf("action %q results: %v", d.Type, err)
	}
	return nil
}

// SignalSubscription selects the signals a plugin receives through OnSignal.
type SignalSubscription struct {
	// ID is chosen by the subscriber and is unique within its set.
	ID string `json:"id"`
	// Signal is "publisher/name", "publisher/group/*", "publisher/*" or "*".
	Signal string `json:"signal"`
	// Filters match declared payload fields by typed equality, combined with AND.
	Filters map[string]SignalValue `json:"filters,omitempty"`
	// IncludeOwn delivers the subscriber's own signals too.
	IncludeOwn bool `json:"include_own,omitempty"`
}

// Equal reports whether s and other select the same deliveries.
func (s *SignalSubscription) Equal(other *SignalSubscription) bool {
	if s.ID != other.ID || s.Signal != other.Signal || s.IncludeOwn != other.IncludeOwn || len(s.Filters) != len(other.Filters) {
		return false
	}
	for key, value := range s.Filters {
		otherValue, ok := other.Filters[key]
		if !ok || !value.Equal(otherValue) {
			return false
		}
	}
	return true
}

type SignalPatternKind int

const (
	SignalPatternExact SignalPatternKind = iota
	SignalPatternGroup
	SignalPatternPublisher
	SignalPatternAll
)

// SignalPattern is a parsed SignalSubscription.Signal.
type SignalPattern struct {
	Kind      SignalPatternKind
	Publisher string
	Group     string
	Name      string
}

// ParseSignalPattern parses "publisher/name", "publisher/group/*", "publisher/*" or "*".
func ParseSignalPattern(pattern string) (SignalPattern, error) {
	parts := strings.Split(pattern, "/")
	invalid := fmt.Errorf("signal pattern %q must be publisher/name, publisher/group/*, publisher/* or *", pattern)
	if len(parts) == 1 {
		if parts[0] == "*" {
			return SignalPattern{Kind: SignalPatternAll}, nil
		}
		return SignalPattern{}, invalid
	}
	if len(parts) > 3 || !IsValidPluginId(parts[0]) {
		return SignalPattern{}, invalid
	}
	if len(parts) == 3 {
		if parts[2] != "*" || !IsValidSignalName(parts[1]) {
			return SignalPattern{}, invalid
		}
		return SignalPattern{Kind: SignalPatternGroup, Publisher: parts[0], Group: parts[1]}, nil
	}
	if parts[1] == "*" {
		return SignalPattern{Kind: SignalPatternPublisher, Publisher: parts[0]}, nil
	}
	if !IsValidSignalName(parts[1]) {
		return SignalPattern{}, invalid
	}
	return SignalPattern{Kind: SignalPatternExact, Publisher: parts[0], Name: parts[1]}, nil
}

// ValidateSignalSubscriptions checks a subscription set without knowing which signals are
// registered: the count, unique IDs, pattern syntax and filter value types. The server also
// checks filters against the declared fields of registered signals.
func ValidateSignalSubscriptions(subs []SignalSubscription) error {
	if len(subs) > MaxSignalSubscriptions {
		return ErrSignalSubscriptionInvalid.Wrapf("at most %d subscriptions are allowed, got %d", MaxSignalSubscriptions, len(subs))
	}
	seen := make(map[string]struct{}, len(subs))
	for i, sub := range subs {
		if strings.TrimSpace(sub.ID) == "" {
			return ErrSignalSubscriptionInvalid.Wrapf("subscription %d requires an ID", i)
		}
		if _, dup := seen[sub.ID]; dup {
			return ErrSignalSubscriptionInvalid.Wrapf("subscription ID %q is used twice", sub.ID)
		}
		seen[sub.ID] = struct{}{}
		if _, err := ParseSignalPattern(sub.Signal); err != nil {
			return ErrSignalSubscriptionInvalid.Wrapf("subscription %q: %v", sub.ID, err)
		}
		for key, value := range sub.Filters {
			if !IsValidSignalName(key) {
				return ErrSignalSubscriptionInvalid.Wrapf("subscription %q filters on invalid key %q", sub.ID, key)
			}
			if err := value.Validate(value.Type, SignalTextMaxRunes, false); err != nil {
				return ErrSignalSubscriptionInvalid.Wrapf("subscription %q filter %q: %v", sub.ID, key, err)
			}
		}
	}
	return nil
}

type SubscriptionOptions struct {
	QueueSize int `json:"queue_size,omitempty"`
	Workers   int `json:"workers,omitempty"`
}

// SignalCause is an opaque token the server hands to plugins with each delivery and action
// call. Plugins pass it back when they emit or call in response, and never inspect it.
type SignalCause string

type EmitOptions struct {
	// OriginUserID is the user whose action started the chain.
	OriginUserID string `json:"origin_user_id,omitempty"`
}

// SignalDelivery is what a subscriber receives in OnSignal.
type SignalDelivery struct {
	// ID is EnvelopeID + ":" + subscriber, stable across redelivery, so subscribers can dedupe on it.
	ID              string                 `json:"id"`
	EnvelopeID      string                 `json:"envelope_id"`
	Signal          string                 `json:"signal"`
	PublisherID     string                 `json:"publisher_id"`
	Version         int                    `json:"version"`
	Payload         map[string]SignalValue `json:"payload"`
	SubscriptionIDs []string               `json:"subscription_ids"`
	TraceID         string                 `json:"trace_id"`
	Hop             int                    `json:"hop"`
	OriginUserID    string                 `json:"origin_user_id,omitempty"`
	Cause           SignalCause            `json:"cause"`
	EmittedAt       int64                  `json:"emitted_at"`
}

// ActionRequest is a call to another plugin's action.
type ActionRequest struct {
	PluginID string                 `json:"plugin_id"`
	Action   string                 `json:"action"`
	Fields   map[string]SignalValue `json:"fields"`
	// ActingUserID is the requested acting user. The server decides the user the target sees.
	ActingUserID string            `json:"acting_user_id,omitempty"`
	Attributes   map[string]string `json:"attributes,omitempty"`
}

// ActionCall is what the target plugin receives in OnActionCall. The server sets
// CallerPluginID, ActingUserID and Cause.
type ActionCall struct {
	Action         string                 `json:"action"`
	Fields         map[string]SignalValue `json:"fields"`
	CallerPluginID string                 `json:"caller_plugin_id"`
	ActingUserID   string                 `json:"acting_user_id"`
	Cause          SignalCause            `json:"cause"`
	Attributes     map[string]string      `json:"attributes,omitempty"`
}

type ActionResult struct {
	Fields map[string]SignalValue `json:"fields"`
}

type ActionResponse struct {
	Fields map[string]SignalValue `json:"fields"`
}

// SignalCatalog is every group, signal and action registered on a node. Hash lets callers
// detect drift between nodes.
type SignalCatalog struct {
	Hash    string             `json:"hash"`
	Groups  []SignalGroup      `json:"groups"`
	Signals []SignalDescriptor `json:"signals"`
	Actions []ActionDescriptor `json:"actions"`
}
