// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"slices"
	"strings"
)

// MaxEventSubscriptions caps the subscriptions one plugin may hold.
const MaxEventSubscriptions = 256

// EventBusError is an error from the plugin event bus. Its ID is stable across the plugin RPC
// boundary, so errors.Is matches a sentinel even when Message carries details.
type EventBusError struct {
	ID      string
	Message string
}

func (e *EventBusError) Error() string {
	return e.Message
}

func (e *EventBusError) Is(target error) bool {
	t, ok := target.(*EventBusError)
	return ok && t.ID == e.ID
}

// Wrapf returns a copy of e with details appended to its message.
func (e *EventBusError) Wrapf(format string, args ...any) *EventBusError {
	return &EventBusError{ID: e.ID, Message: e.Message + ": " + fmt.Sprintf(format, args...)}
}

var (
	ErrEventBusDisabled         = &EventBusError{ID: "event_bus.disabled", Message: "the plugin event bus is disabled"}
	ErrEventNotRegistered       = &EventBusError{ID: "event_bus.event_not_registered", Message: "event is not registered"}
	ErrEventGroupNotRegistered  = &EventBusError{ID: "event_bus.group_not_registered", Message: "event group is not registered"}
	ErrEventDescriptorInvalid   = &EventBusError{ID: "event_bus.descriptor_invalid", Message: "descriptor is invalid"}
	ErrEventSubscriptionInvalid = &EventBusError{ID: "event_bus.subscription_invalid", Message: "subscriptions are invalid"}
	ErrEventPayloadInvalid      = &EventBusError{ID: "event_bus.payload_invalid", Message: "event payload is invalid"}
	ErrSubscriberHookMissing    = &EventBusError{ID: "event_bus.subscriber_hook_missing", Message: "plugin does not implement OnEvent"}
	ErrActionHookMissing        = &EventBusError{ID: "event_bus.action_hook_missing", Message: "plugin does not implement OnActionCall"}
	ErrActionNotFound           = &EventBusError{ID: "event_bus.action_not_found", Message: "action is not registered"}
	ErrActionCallerNotAllowed   = &EventBusError{ID: "event_bus.action_caller_not_allowed", Message: "plugin is not allowed to call this action"}
	ErrActionFieldsInvalid      = &EventBusError{ID: "event_bus.action_fields_invalid", Message: "action fields are invalid"}
	ErrActionResultInvalid      = &EventBusError{ID: "event_bus.action_result_invalid", Message: "action result is invalid"}
	ErrActionCallFailed         = &EventBusError{ID: "event_bus.action_call_failed", Message: "action call failed"}
	ErrActingUserRequired       = &EventBusError{ID: "event_bus.acting_user_required", Message: "an acting user is required"}
	ErrActingUserInvalid        = &EventBusError{ID: "event_bus.acting_user_invalid", Message: "acting user does not exist or is inactive"}
	ErrPluginNotActive          = &EventBusError{ID: "event_bus.plugin_not_active", Message: "plugin is not active"}
)

// EventGroup is a palette heading that holds a publisher's events and actions.
type EventGroup struct {
	PublisherID string `json:"publisher_id"`
	Name        string `json:"name"`
	Label       string `json:"label"`
	Icon        string `json:"icon,omitempty"`
}

func (g *EventGroup) IsValid() error {
	if !IsValidEventName(g.Name) {
		return ErrEventDescriptorInvalid.Wrapf("group name %q must match [a-z0-9_]{1,64}", g.Name)
	}
	if strings.TrimSpace(g.Label) == "" {
		return ErrEventDescriptorInvalid.Wrapf("group %q requires a label", g.Name)
	}
	return nil
}

type EventVisibility string

const (
	EventVisibilityAny       EventVisibility = "any"
	EventVisibilityAllowlist EventVisibility = "allowlist"
)

// EventDescriptor is an event a publisher can emit. Its full name is publisher/name.
type EventDescriptor struct {
	PublisherID string `json:"publisher_id"`
	Name        string `json:"name"`
	Group       string `json:"group,omitempty"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
	// Version starts at 1. Only additive changes are allowed within a version.
	Version            int             `json:"version"`
	Fields             []EventField    `json:"fields"`
	Visibility         EventVisibility `json:"visibility"`
	AllowedSubscribers []string        `json:"allowed_subscribers,omitempty"`
}

// FullName returns publisher/name.
func (d *EventDescriptor) FullName() string {
	return d.PublisherID + "/" + d.Name
}

// IsVisibleTo reports whether subscriberID may receive this event.
func (d *EventDescriptor) IsVisibleTo(subscriberID string) bool {
	return d.Visibility != EventVisibilityAllowlist || slices.Contains(d.AllowedSubscribers, subscriberID)
}

// Validate checks the descriptor and normalizes its visibility and field types.
func (d *EventDescriptor) Validate() error {
	if !IsValidEventName(d.Name) {
		return ErrEventDescriptorInvalid.Wrapf("event name %q must match [a-z0-9_]{1,64}", d.Name)
	}
	if d.Group != "" && !IsValidEventName(d.Group) {
		return ErrEventDescriptorInvalid.Wrapf("event %q has invalid group %q", d.Name, d.Group)
	}
	if strings.TrimSpace(d.Label) == "" {
		return ErrEventDescriptorInvalid.Wrapf("event %q requires a label", d.Name)
	}
	if d.Version < 1 {
		return ErrEventDescriptorInvalid.Wrapf("event %q version must be at least 1", d.Name)
	}
	switch d.Visibility {
	case "":
		d.Visibility = EventVisibilityAny
	case EventVisibilityAny, EventVisibilityAllowlist:
	default:
		return ErrEventDescriptorInvalid.Wrapf("event %q has unknown visibility %q", d.Name, d.Visibility)
	}
	for _, id := range d.AllowedSubscribers {
		if !IsValidPluginId(id) {
			return ErrEventDescriptorInvalid.Wrapf("event %q allows invalid subscriber %q", d.Name, id)
		}
	}
	if err := ValidateEventFields(d.Fields); err != nil {
		return ErrEventDescriptorInvalid.Wrapf("event %q: %v", d.Name, err)
	}
	return nil
}

// ActionDescriptor is an action other plugins can call through OnActionCall.
type ActionDescriptor struct {
	PublisherID string       `json:"publisher_id"`
	Type        string       `json:"type"`
	Group       string       `json:"group,omitempty"`
	Label       string       `json:"label"`
	Description string       `json:"description,omitempty"`
	Fields      []EventField `json:"fields"`
	Results     []EventField `json:"results"`
	// Emits lists the event names the action can emit. It is informational.
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
	if !IsValidEventName(d.Type) {
		return ErrEventDescriptorInvalid.Wrapf("action type %q must match [a-z0-9_]{1,64}", d.Type)
	}
	if d.Group != "" && !IsValidEventName(d.Group) {
		return ErrEventDescriptorInvalid.Wrapf("action %q has invalid group %q", d.Type, d.Group)
	}
	if strings.TrimSpace(d.Label) == "" {
		return ErrEventDescriptorInvalid.Wrapf("action %q requires a label", d.Type)
	}
	if d.TimeoutSeconds < 0 {
		return ErrEventDescriptorInvalid.Wrapf("action %q timeout must not be negative", d.Type)
	}
	for _, name := range d.Emits {
		if !IsValidEventName(name) {
			return ErrEventDescriptorInvalid.Wrapf("action %q emits invalid event name %q", d.Type, name)
		}
	}
	for _, id := range d.AllowedCallers {
		if !IsValidPluginId(id) {
			return ErrEventDescriptorInvalid.Wrapf("action %q allows invalid caller %q", d.Type, id)
		}
	}
	if err := ValidateActionFields(d.Fields); err != nil {
		return ErrEventDescriptorInvalid.Wrapf("action %q fields: %v", d.Type, err)
	}
	if err := ValidateActionFields(d.Results); err != nil {
		return ErrEventDescriptorInvalid.Wrapf("action %q results: %v", d.Type, err)
	}
	return nil
}

// EventSubscription selects the events a plugin receives through OnEvent.
type EventSubscription struct {
	// ID is chosen by the subscriber and is unique within its set.
	ID string `json:"id"`
	// Event is "publisher/name", "publisher/group/*", "publisher/*" or "*".
	Event string `json:"event"`
	// Filters match declared payload fields by typed equality, combined with AND.
	Filters map[string]EventValue `json:"filters,omitempty"`
	// IncludeOwn delivers the subscriber's own events too.
	IncludeOwn bool `json:"include_own,omitempty"`
}

// Equal reports whether s and other select the same deliveries.
func (s *EventSubscription) Equal(other *EventSubscription) bool {
	if s.ID != other.ID || s.Event != other.Event || s.IncludeOwn != other.IncludeOwn || len(s.Filters) != len(other.Filters) {
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

type EventPatternKind int

const (
	EventPatternExact EventPatternKind = iota
	EventPatternGroup
	EventPatternPublisher
	EventPatternAll
)

// EventPattern is a parsed EventSubscription.Event.
type EventPattern struct {
	Kind      EventPatternKind
	Publisher string
	Group     string
	Name      string
}

// ParseEventPattern parses "publisher/name", "publisher/group/*", "publisher/*" or "*".
func ParseEventPattern(pattern string) (EventPattern, error) {
	parts := strings.Split(pattern, "/")
	invalid := fmt.Errorf("event pattern %q must be publisher/name, publisher/group/*, publisher/* or *", pattern)
	if len(parts) == 1 {
		if parts[0] == "*" {
			return EventPattern{Kind: EventPatternAll}, nil
		}
		return EventPattern{}, invalid
	}
	if len(parts) > 3 || !IsValidPluginId(parts[0]) {
		return EventPattern{}, invalid
	}
	if len(parts) == 3 {
		if parts[2] != "*" || !IsValidEventName(parts[1]) {
			return EventPattern{}, invalid
		}
		return EventPattern{Kind: EventPatternGroup, Publisher: parts[0], Group: parts[1]}, nil
	}
	if parts[1] == "*" {
		return EventPattern{Kind: EventPatternPublisher, Publisher: parts[0]}, nil
	}
	if !IsValidEventName(parts[1]) {
		return EventPattern{}, invalid
	}
	return EventPattern{Kind: EventPatternExact, Publisher: parts[0], Name: parts[1]}, nil
}

// ValidateEventSubscriptions checks a subscription set without knowing which events are
// registered: the count, unique IDs, pattern syntax and filter value types. The server also
// checks filters against the declared fields of registered events.
func ValidateEventSubscriptions(subs []EventSubscription) error {
	if len(subs) > MaxEventSubscriptions {
		return ErrEventSubscriptionInvalid.Wrapf("at most %d subscriptions are allowed, got %d", MaxEventSubscriptions, len(subs))
	}
	seen := make(map[string]struct{}, len(subs))
	for i, sub := range subs {
		if strings.TrimSpace(sub.ID) == "" {
			return ErrEventSubscriptionInvalid.Wrapf("subscription %d requires an ID", i)
		}
		if _, dup := seen[sub.ID]; dup {
			return ErrEventSubscriptionInvalid.Wrapf("subscription ID %q is used twice", sub.ID)
		}
		seen[sub.ID] = struct{}{}
		if _, err := ParseEventPattern(sub.Event); err != nil {
			return ErrEventSubscriptionInvalid.Wrapf("subscription %q: %v", sub.ID, err)
		}
		for key, value := range sub.Filters {
			if !IsValidEventName(key) {
				return ErrEventSubscriptionInvalid.Wrapf("subscription %q filters on invalid key %q", sub.ID, key)
			}
			if err := value.Validate(value.Type, EventTextMaxRunes, false); err != nil {
				return ErrEventSubscriptionInvalid.Wrapf("subscription %q filter %q: %v", sub.ID, key, err)
			}
		}
	}
	return nil
}

type SubscriptionOptions struct {
	QueueSize int `json:"queue_size,omitempty"`
	Workers   int `json:"workers,omitempty"`
}

// EventCause is an opaque token the server hands to plugins with each delivery and action
// call. Plugins pass it back when they emit or call in response, and never inspect it.
type EventCause string

type EmitOptions struct {
	// OriginUserID is the user whose action started the chain.
	OriginUserID string `json:"origin_user_id,omitempty"`
}

// EventDelivery is what a subscriber receives in OnEvent.
type EventDelivery struct {
	// ID is EnvelopeID + ":" + subscriber, stable across redelivery, so subscribers can dedupe on it.
	ID              string                `json:"id"`
	EnvelopeID      string                `json:"envelope_id"`
	Event           string                `json:"event"`
	PublisherID     string                `json:"publisher_id"`
	Version         int                   `json:"version"`
	Payload         map[string]EventValue `json:"payload"`
	SubscriptionIDs []string              `json:"subscription_ids"`
	TraceID         string                `json:"trace_id"`
	Hop             int                   `json:"hop"`
	OriginUserID    string                `json:"origin_user_id,omitempty"`
	Cause           EventCause            `json:"cause"`
	EmittedAt       int64                 `json:"emitted_at"`
}

// ActionRequest is a call to another plugin's action.
type ActionRequest struct {
	PluginID string                `json:"plugin_id"`
	Action   string                `json:"action"`
	Fields   map[string]EventValue `json:"fields"`
	// ActingUserID is the requested acting user. The server decides the user the target sees.
	ActingUserID string            `json:"acting_user_id,omitempty"`
	Attributes   map[string]string `json:"attributes,omitempty"`
}

// ActionCall is what the target plugin receives in OnActionCall. The server sets
// CallerPluginID, ActingUserID and Cause.
type ActionCall struct {
	Action         string                `json:"action"`
	Fields         map[string]EventValue `json:"fields"`
	CallerPluginID string                `json:"caller_plugin_id"`
	ActingUserID   string                `json:"acting_user_id"`
	Cause          EventCause            `json:"cause"`
	Attributes     map[string]string     `json:"attributes,omitempty"`
}

type ActionResult struct {
	Fields map[string]EventValue `json:"fields"`
}

type ActionResponse struct {
	Fields map[string]EventValue `json:"fields"`
}

// EventCatalog is every group, event and action registered on a node. Hash lets callers
// detect drift between nodes.
type EventCatalog struct {
	Hash    string             `json:"hash"`
	Groups  []EventGroup       `json:"groups"`
	Events  []EventDescriptor  `json:"events"`
	Actions []ActionDescriptor `json:"actions"`
}
