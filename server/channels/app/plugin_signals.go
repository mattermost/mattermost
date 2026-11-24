// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/signalbus"
)

func newSignalBus(ch *Channels) (*signalbus.Bus, error) {
	return signalbus.New(signalbus.Options{
		Hooks:  &signalBusHooks{ch: ch},
		Logger: ch.srv.Log(),
		Enabled: func() bool {
			return ch.cfgSvc.Config().FeatureFlags.PluginSignalBus
		},
	})
}

// signalBusHooks reaches plugins on behalf of the signal bus.
type signalBusHooks struct {
	ch *Channels
}

func (h *signalBusHooks) IsActive(pluginID string) bool {
	env := h.ch.GetPluginsEnvironment()
	return env != nil && env.IsActive(pluginID)
}

func (h *signalBusHooks) IsStarting(pluginID string) bool {
	env := h.ch.GetPluginsEnvironment()
	return env != nil && env.IsStarting(pluginID)
}

func (h *signalBusHooks) Implements(pluginID string, hookID int) bool {
	env := h.ch.GetPluginsEnvironment()
	return env != nil && env.PluginImplements(pluginID, hookID)
}

func (h *signalBusHooks) OnSignal(pluginID string, d *model.SignalDelivery) error {
	hooks, err := h.ch.HooksForPluginWithRPCErr(pluginID)
	if err != nil {
		return err
	}
	return hooks.OnSignalWithRPCErr(&plugin.Context{}, d)
}

func (h *signalBusHooks) OnActionCall(pluginID string, call *model.ActionCall) (*model.ActionResult, error) {
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
func (h *signalBusHooks) BotUserID(pluginID string) (string, error) {
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

func (h *signalBusHooks) UserIsActive(userID string) bool {
	user, err := h.ch.srv.Store().User().Get(request.EmptyContext(h.ch.srv.Log()), userID)
	return err == nil && user.DeleteAt == 0
}

func (api *PluginAPI) signalBus() *signalbus.Bus {
	return api.app.Channels().signalBus
}

func (api *PluginAPI) RegisterSignalGroup(group model.SignalGroup) error {
	return api.signalBus().RegisterGroup(api.id, group)
}

func (api *PluginAPI) RegisterSignal(signal model.SignalDescriptor) error {
	return api.signalBus().RegisterSignal(api.id, signal)
}

func (api *PluginAPI) RegisterAction(action model.ActionDescriptor) error {
	return api.signalBus().RegisterAction(api.id, action)
}

func (api *PluginAPI) SetSubscriptions(subs []model.SignalSubscription, opts model.SubscriptionOptions) error {
	return api.signalBus().SetSubscriptions(api.id, subs, opts)
}

func (api *PluginAPI) EmitSignal(name string, payload map[string]model.SignalValue, cause model.SignalCause, opts *model.EmitOptions) error {
	return api.signalBus().Emit(api.id, name, payload, cause, opts)
}

func (api *PluginAPI) ExecuteAction(req *model.ActionRequest, cause model.SignalCause) (*model.ActionResponse, error) {
	resp, err := api.signalBus().ExecuteAction(api.id, req, cause)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func (api *PluginAPI) ListSignalContributions() (*model.SignalCatalog, error) {
	return api.signalBus().Catalog()
}
