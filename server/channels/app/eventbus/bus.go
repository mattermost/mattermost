// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package eventbus lets plugins publish typed events, subscribe to each other's events, and
// call each other's actions. It holds per-node state only and reaches plugins through
// HookInvoker, so it never depends on the app layer.
package eventbus

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	DefaultQueueSize = 1000

	localConsumer = "local"
)

// HookInvoker is how the bus reaches plugins. The app layer implements it.
type HookInvoker interface {
	IsActive(pluginID string) bool
	// IsStarting reports whether the plugin is active but its OnActivate hasn't returned yet. Its
	// hooks can't be called until then.
	IsStarting(pluginID string) bool
	Implements(pluginID string, hookID int) bool
	OnEvent(pluginID string, d *model.EventDelivery) error
	// OnActionCall returns the target's *model.AppError as is; any other error is a transport failure.
	OnActionCall(pluginID string, call *model.ActionCall) (*model.ActionResult, error)
	BotUserID(pluginID string) (string, error)
	UserIsActive(userID string) bool
}

type Options struct {
	Hooks  HookInvoker
	Logger *mlog.Logger
	// Enabled gates every operation except DropPlugin. Nil means always enabled.
	Enabled func() bool
	// QueueSize is the number of deliveries each subscriber may have pending. Zero means DefaultQueueSize.
	QueueSize int
}

type Bus struct {
	hooks     HookInvoker
	logger    *mlog.Logger
	enabled   func() bool
	queueSize int

	registry    *registry
	subs        *subscriptionSet
	transport   eventTransport
	unsubscribe func()
}

func New(opts Options) (*Bus, error) {
	if opts.Hooks == nil {
		return nil, fmt.Errorf("event bus requires a hook invoker")
	}
	if opts.Logger == nil {
		return nil, fmt.Errorf("event bus requires a logger")
	}
	if opts.QueueSize <= 0 {
		opts.QueueSize = DefaultQueueSize
	}

	b := &Bus{
		hooks:     opts.Hooks,
		logger:    opts.Logger,
		enabled:   opts.Enabled,
		queueSize: opts.QueueSize,
		registry:  newRegistry(),
		subs:      newSubscriptionSet(),
		transport: newMemoryTransport(),
	}

	unsubscribe, err := b.transport.Subscribe(localConsumer, b.dispatch)
	if err != nil {
		return nil, fmt.Errorf("failed to subscribe to the event transport: %w", err)
	}
	b.unsubscribe = unsubscribe

	return b, nil
}

// Close stops every subscriber queue and detaches from the transport.
func (b *Bus) Close() {
	b.unsubscribe()
	b.subs.dropAll()
}

func (b *Bus) isEnabled() bool {
	return b.enabled == nil || b.enabled()
}

func (b *Bus) RegisterGroup(pluginID string, group model.EventGroup) error {
	if !b.isEnabled() {
		return model.ErrEventBusDisabled
	}
	// A call still in flight when the plugin was dropped must not register it again.
	if !b.hooks.IsActive(pluginID) {
		return model.ErrPluginNotActive.Wrapf("%s", pluginID)
	}
	return b.registry.registerGroup(pluginID, group)
}

func (b *Bus) RegisterEvent(pluginID string, event model.EventDescriptor) error {
	if !b.isEnabled() {
		return model.ErrEventBusDisabled
	}
	if !b.hooks.IsActive(pluginID) {
		return model.ErrPluginNotActive.Wrapf("%s", pluginID)
	}
	return b.registry.registerEvent(pluginID, event)
}

func (b *Bus) RegisterAction(pluginID string, action model.ActionDescriptor) error {
	if !b.isEnabled() {
		return model.ErrEventBusDisabled
	}
	if !b.hooks.Implements(pluginID, plugin.OnActionCallID) {
		return model.ErrActionHookMissing
	}
	return b.registry.registerAction(pluginID, action)
}

// Emit validates the payload against the plugin's registered event and publishes it. It
// returns without waiting on any subscriber.
func (b *Bus) Emit(pluginID, name string, payload map[string]model.EventValue, cause model.EventCause, opts *model.EmitOptions) error {
	if !b.isEnabled() {
		return model.ErrEventBusDisabled
	}

	event, ok := b.registry.event(pluginID, name)
	if !ok {
		return model.ErrEventNotRegistered.Wrapf("%s/%s", pluginID, name)
	}

	normalized, err := model.ValidateEventPayload(event.Fields, payload)
	if err != nil {
		return model.ErrEventPayloadInvalid.Wrapf("%s: %v", event.FullName(), err)
	}

	env := &eventEnvelope{
		ID:                 model.NewId(),
		PublisherID:        pluginID,
		Name:               event.Name,
		Group:              event.Group,
		Version:            event.Version,
		Visibility:         event.Visibility,
		AllowedSubscribers: event.AllowedSubscribers,
		Payload:            normalized,
		TraceID:            model.NewId(),
		Cause:              cause,
		EmittedAt:          model.GetMillis(),
	}
	if opts != nil {
		env.OriginUserID = opts.OriginUserID
	}

	if err := b.transport.Publish(env); err != nil {
		return fmt.Errorf("failed to publish event %s: %w", event.FullName(), err)
	}
	return nil
}

// Catalog returns every registered group, event and action.
func (b *Bus) Catalog() (*model.EventCatalog, error) {
	if !b.isEnabled() {
		return nil, model.ErrEventBusDisabled
	}
	return b.registry.catalog()
}

// DropPlugin removes everything the plugin registered, its subscriptions, and its queue along
// with any pending deliveries. It runs whether or not the bus is enabled.
func (b *Bus) DropPlugin(pluginID string) {
	b.registry.drop(pluginID)
	b.subs.drop(pluginID)
}
