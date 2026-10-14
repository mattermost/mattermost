// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/pkg/errors"
)

const (
	automationPayloadMaxBytes = 16 * 1024

	automationTraceHeader = "Mattermost-Weave-Trace-Token"

	// automationClaimPluginID namespaces delivery claims in PluginKeyValueStore.
	// It is not an installed plugin.
	automationClaimPluginID = "mattermost-automation"
	automationClaimTTL      = 10 * time.Minute
)

var automationTextKeys = map[string]struct{}{
	"summary": {}, "details": {}, "message": {}, "title": {}, "text": {},
	"description": {}, "retrospective": {}, "task": {}, "username": {}, "email": {},
	"old_value": {}, "new_value": {}, "old_value_display": {}, "new_value_display": {},
}

var automationReservedKeys = map[string]struct{}{
	"pluginid": {}, "signal": {}, "steps": {}, "vars": {}, "secrets": {},
	"channelid": {}, "teamid": {}, "userid": {},
}

var automationIdentityKeys = map[string]struct{}{
	"user_id": {}, "team_id": {}, "channel_id": {}, "run_id": {}, "playbook_id": {},
	"page_id": {}, "post_id": {}, "item_id": {}, "comment_id": {}, "parent_id": {},
}

type automationTrace struct {
	ID      string
	TraceID string
	Hop     int
	Holder  string
	BoundTo string
}

type automationRegistry struct {
	mu      sync.Mutex
	groups  map[string]map[string]model.AutomationGroupDescriptor
	signals map[string]map[string]model.AutomationSignalDescriptor
	actions map[string]map[string]model.AutomationActionDescriptor
	traces  map[string]*automationTrace
}

func newAutomationRegistry() *automationRegistry {
	return &automationRegistry{
		groups:  map[string]map[string]model.AutomationGroupDescriptor{},
		signals: map[string]map[string]model.AutomationSignalDescriptor{},
		actions: map[string]map[string]model.AutomationActionDescriptor{},
		traces:  map[string]*automationTrace{},
	}
}

func (ch *Channels) getAutomationRegistry() *automationRegistry {
	ch.automationRegistryOnce.Do(func() {
		ch.automationRegistry = newAutomationRegistry()
	})
	return ch.automationRegistry
}

func (r *automationRegistry) drop(pluginID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.groups, pluginID)
	delete(r.signals, pluginID)
	delete(r.actions, pluginID)
}

func (r *automationRegistry) registerGroup(pluginID string, group model.AutomationGroupDescriptor, iconURL string) error {
	if strings.TrimSpace(group.Label) == "" {
		return errors.New("automation group requires a label")
	}
	group.PluginID = pluginID
	if group.Icon == "" {
		group.IconURL = iconURL
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.groups[pluginID] == nil {
		r.groups[pluginID] = map[string]model.AutomationGroupDescriptor{}
	}
	r.groups[pluginID][group.Label] = group
	return nil
}

func (r *automationRegistry) registerSignal(pluginID string, signal model.AutomationSignalDescriptor) error {
	if strings.TrimSpace(signal.Name) == "" {
		return errors.New("automation signal requires a name")
	}
	if err := validateSignalFields(signal.Fields); err != nil {
		return err
	}
	signal.PluginID = pluginID
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.signals[pluginID] == nil {
		r.signals[pluginID] = map[string]model.AutomationSignalDescriptor{}
	}
	r.signals[pluginID][signal.Name] = signal
	return nil
}

func (r *automationRegistry) registerAction(pluginID string, action model.AutomationActionDescriptor) error {
	if strings.TrimSpace(action.Type) == "" {
		return errors.New("automation action requires a type")
	}
	method, err := automationMethod(action.Method)
	if err != nil {
		return err
	}
	action.Method = method
	if !strings.HasPrefix(action.Path, "/") {
		return errors.New("automation action path must start with /")
	}
	if err := validateActionFields(action.Fields); err != nil {
		return err
	}
	if err := validateActionFields(action.Results); err != nil {
		return err
	}
	for _, name := range action.Emits {
		if strings.TrimSpace(name) == "" {
			return errors.New("automation action emit requires a signal name")
		}
	}
	action.PluginID = pluginID
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.actions[pluginID] == nil {
		r.actions[pluginID] = map[string]model.AutomationActionDescriptor{}
	}
	r.actions[pluginID][action.Type] = action
	return nil
}

func (r *automationRegistry) signalDescriptor(pluginID, name string) (model.AutomationSignalDescriptor, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	signal, ok := r.signals[pluginID][name]
	return signal, ok
}

func (r *automationRegistry) actionDescriptor(pluginID, actionType string) (model.AutomationActionDescriptor, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	action, ok := r.actions[pluginID][actionType]
	return action, ok
}

func (r *automationRegistry) list() ([]model.AutomationGroupDescriptor, []model.AutomationSignalDescriptor, []model.AutomationActionDescriptor) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var groups []model.AutomationGroupDescriptor
	var signals []model.AutomationSignalDescriptor
	var actions []model.AutomationActionDescriptor
	for _, byLabel := range r.groups {
		for _, group := range byLabel {
			groups = append(groups, group)
		}
	}
	for _, byName := range r.signals {
		for _, signal := range byName {
			signals = append(signals, signal)
		}
	}
	for _, byType := range r.actions {
		for _, action := range byType {
			actions = append(actions, action)
		}
	}
	return groups, signals, actions
}

func validateSignalFields(fields []model.AutomationField) error {
	seen := map[string]struct{}{}
	for i := range fields {
		field := &fields[i]
		key := strings.TrimSpace(field.Key)
		if key == "" {
			return errors.New("automation field requires a key")
		}
		if _, dup := seen[key]; dup {
			return errors.Errorf("automation field %s is declared twice", key)
		}
		seen[key] = struct{}{}
		field.Key = key
		field.Type = field.Type.Normalize()
		lower := strings.ToLower(key)
		if _, blocked := automationTextKeys[lower]; blocked {
			return errors.Errorf("automation signal field %s is not allowed", key)
		}
		if _, reserved := automationReservedKeys[lower]; reserved {
			return errors.Errorf("automation signal field %s is reserved", key)
		}
		if !field.Type.IsKnown() || field.Type == model.AutomationValueTextarea {
			return errors.Errorf("automation signal field %s has type %s", key, field.Type)
		}
		if _, identity := automationIdentityKeys[key]; identity && field.Type != model.AutomationValueText {
			return errors.Errorf("automation signal field %s must be text", key)
		}
	}
	return nil
}

func validateActionFields(fields []model.AutomationField) error {
	seen := map[string]struct{}{}
	for i := range fields {
		field := &fields[i]
		key := strings.TrimSpace(field.Key)
		if key == "" {
			return errors.New("automation field requires a key")
		}
		if _, dup := seen[key]; dup {
			return errors.Errorf("automation field %s is declared twice", key)
		}
		seen[key] = struct{}{}
		field.Key = key
		field.Type = field.Type.Normalize()
		if !field.Type.IsKnown() {
			return errors.Errorf("automation action field %s has type %s", key, field.Type)
		}
	}
	return nil
}

func validateAutomationPayload(fields []model.AutomationField, payload map[string]model.AutomationValue) error {
	if payload == nil {
		return nil
	}
	declared := map[string]model.AutomationField{}
	for _, field := range fields {
		declared[field.Key] = field
	}
	for key, value := range payload {
		field, ok := declared[key]
		if !ok {
			return errors.Errorf("automation signal field %s is not declared", key)
		}
		checked := value
		if err := checked.Validate(field.Type, model.AutomationSignalTextMaxRunes, false); err != nil {
			return errors.Wrapf(err, "automation signal field %s", key)
		}
		payload[key] = checked
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if len(encoded) > automationPayloadMaxBytes {
		return errors.New("automation signal payload exceeds 16 KiB")
	}
	return nil
}

func filterDeclaredValues(fields []model.AutomationField, values map[string]model.AutomationValue, textMax int, allowTextarea bool) (map[string]model.AutomationValue, error) {
	declared := map[string]model.AutomationField{}
	for _, field := range fields {
		declared[field.Key] = field
	}
	out := map[string]model.AutomationValue{}
	for key, value := range values {
		field, ok := declared[key]
		if !ok {
			continue
		}
		checked := value
		if err := checked.Validate(field.Type, textMax, allowTextarea); err != nil {
			return nil, errors.Wrapf(err, "automation field %s", key)
		}
		out[key] = checked
	}
	return out, nil
}

// acceptTrace starts a chain or advances one. The returned event is what subscribers receive.
// The returned token is the one the subscriber may hand to the next action call.
func (r *automationRegistry) acceptTrace(pluginID, name string, payload map[string]model.AutomationValue, traceToken string) (*model.AutomationSignalEvent, error) {
	signal, ok := r.signalDescriptor(pluginID, name)
	if !ok {
		return nil, errors.Errorf("plugin %s has not registered signal %s", pluginID, name)
	}
	if err := validateAutomationPayload(signal.Fields, payload); err != nil {
		return nil, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	hop := 0
	traceID := model.NewId()
	if traceToken != "" {
		trace := r.traces[traceToken]
		if trace == nil || trace.BoundTo != pluginID {
			return nil, errors.New("automation trace token was not issued for this plugin")
		}
		hop = trace.Hop + 1
		traceID = trace.TraceID
		delete(r.traces, traceToken)
	}
	if hop >= model.MaxAutomationHops {
		return nil, errors.Errorf("automation chain exceeded %d hops", model.MaxAutomationHops)
	}

	next := &automationTrace{
		ID:      model.NewId(),
		TraceID: traceID,
		Hop:     hop,
		Holder:  "",
	}
	r.traces[next.ID] = next
	return &model.AutomationSignalEvent{
		PluginID:   pluginID,
		Signal:     name,
		Payload:    payload,
		Hop:        hop,
		TraceToken: next.ID,
		TraceID:    traceID,
	}, nil
}

// adoptTrace installs a trace that was created on another node so a later
// action call on this node can redeem it.
func (r *automationRegistry) adoptTrace(event *model.AutomationSignalEvent) {
	if event == nil || event.TraceToken == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.traces[event.TraceToken]; ok {
		return
	}
	traceID := event.TraceID
	if traceID == "" {
		traceID = event.TraceToken
	}
	r.traces[event.TraceToken] = &automationTrace{
		ID:      event.TraceToken,
		TraceID: traceID,
		Hop:     event.Hop,
	}
}

// bindTrace lets the plugin that received a signal hand it to the plugin it is calling.
func (r *automationRegistry) bindTrace(token, sourcePluginID, destinationPluginID string) {
	if token == "" || sourcePluginID == "" || destinationPluginID == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	trace := r.traces[token]
	if trace == nil {
		return
	}
	if trace.Holder != "" && trace.Holder != sourcePluginID {
		return
	}
	trace.BoundTo = destinationPluginID
}

// holdTrace records which subscriber may forward the token. Called when the event is delivered.
func (r *automationRegistry) holdTrace(token, subscriberID string) {
	if token == "" || subscriberID == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if trace := r.traces[token]; trace != nil && trace.Holder == "" {
		trace.Holder = subscriberID
	}
}

func (ch *Channels) deliverAutomationSignal(event *model.AutomationSignalEvent) {
	if event == nil {
		return
	}
	ch.RunMultiHook(func(hooks plugin.Hooks, manifest *model.Manifest) bool {
		if manifest != nil {
			ch.getAutomationRegistry().holdTrace(event.TraceToken, manifest.Id)
		}
		hooks.OnAutomationSignal(&plugin.Context{}, event)
		return true
	}, plugin.OnAutomationSignalID)
}

func (api *PluginAPI) iconURL() string {
	if api.manifest == nil || api.manifest.IconPath == "" {
		return ""
	}
	return "/plugins/" + api.id + "/" + strings.TrimPrefix(api.manifest.IconPath, "/")
}

func (api *PluginAPI) RegisterAutomationGroup(group model.AutomationGroupDescriptor) error {
	return api.app.ch.getAutomationRegistry().registerGroup(api.id, group, api.iconURL())
}

func (api *PluginAPI) RegisterAutomationSignal(signal model.AutomationSignalDescriptor) error {
	return api.app.ch.getAutomationRegistry().registerSignal(api.id, signal)
}

func (api *PluginAPI) RegisterAutomationAction(action model.AutomationActionDescriptor) error {
	return api.app.ch.getAutomationRegistry().registerAction(api.id, action)
}

func (ch *Channels) hasAutomationSubscriber() bool {
	env := ch.GetPluginsEnvironment()
	if env == nil {
		return false
	}
	for _, bundle := range env.Active() {
		if bundle == nil || bundle.Manifest == nil {
			continue
		}
		if env.PluginImplements(bundle.Manifest.Id, plugin.OnAutomationSignalID) {
			return true
		}
	}
	return false
}

// claimAutomationDelivery is the cross-node exactly-once gate. The first node
// to insert the token wins.
func (ch *Channels) claimAutomationDelivery(token string) bool {
	if token == "" || ch.srv == nil || ch.srv.Store() == nil {
		return false
	}
	ok, err := ch.srv.Store().Plugin().CompareAndSet(&model.PluginKeyValue{
		PluginId: automationClaimPluginID,
		Key:      "deliver-" + token,
		Value:    []byte("1"),
		ExpireAt: model.GetMillis() + automationClaimTTL.Milliseconds(),
	}, nil)
	if err != nil {
		ch.srv.Log().Warn("Failed to claim automation signal delivery", mlog.Err(err))
		return false
	}
	return ok
}

func (a *App) forwardAutomationSignal(event *model.AutomationSignalEvent) {
	if a == nil || a.Cluster() == nil || event == nil {
		return
	}
	buf, err := json.Marshal(event)
	if err != nil {
		return
	}
	a.Cluster().SendClusterMessage(&model.ClusterMessage{
		Event:            model.ClusterEventAutomationSignal,
		SendType:         model.ClusterSendReliable,
		WaitForAllToSend: true,
		Data:             buf,
	})
}

// deliverForwardedAutomationSignal handles a signal forwarded because the
// emitting node had no subscriber.
func (ch *Channels) deliverForwardedAutomationSignal(event *model.AutomationSignalEvent) {
	if event == nil || !ch.hasAutomationSubscriber() {
		return
	}
	if !ch.claimAutomationDelivery(event.TraceToken) {
		return
	}
	ch.getAutomationRegistry().adoptTrace(event)
	ch.deliverAutomationSignal(event)
}

func (api *PluginAPI) EmitAutomationSignal(name string, payload map[string]model.AutomationValue, traceToken string) error {
	event, err := api.app.ch.getAutomationRegistry().acceptTrace(api.id, name, payload, traceToken)
	if err != nil {
		return err
	}
	if api.app.ch.hasAutomationSubscriber() {
		api.app.ch.deliverAutomationSignal(event)
		return nil
	}
	api.app.forwardAutomationSignal(event)
	return nil
}

func (api *PluginAPI) ExecuteAutomationAction(req *model.AutomationActionRequest) (*model.AutomationActionResponse, error) {
	env := api.app.GetPluginsEnvironment()
	if env == nil || !env.PluginImplements(api.id, plugin.OnAutomationSignalID) {
		return nil, errors.New("executing an automation action requires OnAutomationSignal")
	}
	if req == nil || req.PluginID == "" || req.Action == "" {
		return nil, errors.New("automation action requires a plugin and an action")
	}
	if strings.TrimSpace(req.ActingUserID) == "" {
		return nil, errors.New("automation action requires an acting user")
	}
	registry := api.app.ch.getAutomationRegistry()
	action, ok := registry.actionDescriptor(req.PluginID, req.Action)
	if !ok {
		return nil, errors.Errorf("plugin %s has not registered action %s", req.PluginID, req.Action)
	}
	fields, err := filterDeclaredValues(action.Fields, req.Fields, model.AutomationActionTextMaxRunes, true)
	if err != nil {
		return nil, err
	}
	method, route, body, err := renderAutomationRequest(action, fields)
	if err != nil {
		return nil, err
	}
	if len(body) > model.AutomationActionMaxBytes {
		return nil, errors.New("automation action request exceeds 1 MiB")
	}
	if req.TraceToken != "" {
		registry.bindTrace(req.TraceToken, api.id, req.PluginID)
	}
	status, respBody, err := api.callAutomationHTTP(req, method, route, body)
	if err != nil {
		return nil, err
	}
	returned, err := projectAutomationResults(action.Results, status, respBody)
	if err != nil {
		return nil, err
	}
	filtered, err := filterDeclaredValues(action.Results, returned, model.AutomationActionTextMaxRunes, true)
	if err != nil {
		return nil, err
	}
	out := &model.AutomationActionResponse{Fields: filtered}
	encoded, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	if len(encoded) > model.AutomationActionMaxBytes {
		return nil, errors.New("automation action result exceeds 1 MiB")
	}
	return out, nil
}

func (api *PluginAPI) ListAutomationContributions() ([]model.AutomationGroupDescriptor, []model.AutomationSignalDescriptor, []model.AutomationActionDescriptor, error) {
	env := api.app.GetPluginsEnvironment()
	if env == nil || !env.PluginImplements(api.id, plugin.OnAutomationSignalID) {
		return nil, nil, nil, errors.New("listing automation contributions requires OnAutomationSignal")
	}
	groups, signals, actions := api.app.ch.getAutomationRegistry().list()
	return groups, signals, actions, nil
}

// bindAutomationTrace records that an inter-plugin call is carrying a server-issued token.
func (a *App) bindAutomationTrace(token, sourcePluginID, destinationPluginID string) {
	a.ch.getAutomationRegistry().bindTrace(token, sourcePluginID, destinationPluginID)
}

func automationTraceFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	return r.Header.Get(automationTraceHeader)
}
