// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/eventbus"
)

func newEventBus(ch *Channels) (*eventbus.Bus, error) {
	return eventbus.New(eventbus.Options{
		Hooks:  &eventBusHooks{ch: ch},
		Logger: ch.srv.Log(),
		Enabled: func() bool {
			return ch.cfgSvc.Config().FeatureFlags.PluginEventBus
		},
	})
}

// eventBusHooks reaches plugins on behalf of the event bus.
type eventBusHooks struct {
	ch *Channels
}

func (h *eventBusHooks) IsActive(pluginID string) bool {
	env := h.ch.GetPluginsEnvironment()
	return env != nil && env.IsActive(pluginID)
}

func (h *eventBusHooks) IsStarting(pluginID string) bool {
	env := h.ch.GetPluginsEnvironment()
	return env != nil && env.IsStarting(pluginID)
}

func (h *eventBusHooks) Implements(pluginID string, hookID int) bool {
	env := h.ch.GetPluginsEnvironment()
	return env != nil && env.PluginImplements(pluginID, hookID)
}

func (h *eventBusHooks) OnEvent(pluginID string, d *model.EventDelivery) error {
	hooks, err := h.ch.HooksForPluginWithRPCErr(pluginID)
	if err != nil {
		return err
	}
	return hooks.OnEventWithRPCErr(&plugin.Context{}, d)
}

func (h *eventBusHooks) OnActionCall(pluginID string, call *model.ActionCall) (*model.ActionResult, error) {
	hooks, err := h.ch.HooksForPluginWithRPCErr(pluginID)
	if err != nil {
		return nil, err
	}
	result, appErr, err := hooks.OnActionCallWithRPCErr(&plugin.Context{}, call)
	if err != nil {
		return nil, err
	}
	if appErr != nil {
		return nil, appErr
	}
	return result, nil
}

// BotUserID returns the bot the plugin ensured through EnsureBot, or else a bot it owns. It
// returns an empty ID when the plugin has no bot.
func (h *eventBusHooks) BotUserID(pluginID string) (string, error) {
	// getPluginKey also finds keys written hashed, before 5.6, as EnsureBot does.
	botID, appErr := h.ch.srv.getPluginKey(pluginID, botUserKey)
	if appErr != nil {
		return "", fmt.Errorf("failed to look up the bot of plugin %s: %w", pluginID, appErr)
	}
	if len(botID) > 0 {
		return string(botID), nil
	}

	bots, err := h.ch.srv.Store().Bot().GetAll(&model.BotGetOptions{OwnerId: pluginID, PerPage: 1})
	if err != nil {
		return "", fmt.Errorf("failed to look up the bots of plugin %s: %w", pluginID, err)
	}
	if len(bots) == 0 {
		return "", nil
	}
	return bots[0].UserId, nil
}

func (h *eventBusHooks) UserIsActive(userID string) bool {
	user, err := h.ch.srv.Store().User().Get(request.EmptyContext(h.ch.srv.Log()), userID)
	return err == nil && user.DeleteAt == 0
}

func (api *PluginAPI) eventBus() *eventbus.Bus {
	return api.app.Channels().eventBus
}

func (api *PluginAPI) RegisterEventGroup(group model.EventGroup) error {
	return api.eventBus().RegisterGroup(api.id, group)
}

func (api *PluginAPI) RegisterEvent(event model.EventDescriptor) error {
	return api.eventBus().RegisterEvent(api.id, event)
}

func (api *PluginAPI) RegisterAction(action model.ActionDescriptor) error {
	return api.eventBus().RegisterAction(api.id, action)
}

func (api *PluginAPI) SetSubscriptions(subs []model.EventSubscription, opts model.SubscriptionOptions) error {
	return api.eventBus().SetSubscriptions(api.id, subs, opts)
}

func (api *PluginAPI) EmitEvent(name string, payload map[string]model.EventValue, cause model.EventCause, opts *model.EmitOptions) error {
	return api.eventBus().Emit(api.id, name, payload, cause, opts)
}

func (api *PluginAPI) ExecuteAction(req *model.ActionRequest, cause model.EventCause) (*model.ActionResponse, error) {
	resp, err := api.eventBus().ExecuteAction(api.id, req, cause)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (api *PluginAPI) ListEventContributions() (*model.EventCatalog, error) {
	return api.eventBus().Catalog()
}
