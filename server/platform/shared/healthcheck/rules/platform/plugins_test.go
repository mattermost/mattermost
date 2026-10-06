// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	callsID  = "com.mattermost.calls"
	gitlabID = "com.github.manland.mattermost-plugin-gitlab"
	jiraID   = "jira"
)

func pluginList(enabled, disabled []string) *model.SupportPacketPluginList {
	list := &model.SupportPacketPluginList{Enabled: []model.Manifest{}, Disabled: []model.Manifest{}}
	for _, id := range enabled {
		list.Enabled = append(list.Enabled, model.Manifest{Id: id})
	}
	for _, id := range disabled {
		list.Disabled = append(list.Disabled, model.Manifest{Id: id})
	}
	return list
}

// pluginSnapshot returns a snapshot with plugins on, the given plugin states, and the plugin list when it is non-nil.
func pluginSnapshot(states map[string]*model.PluginState, plugins *model.SupportPacketPluginList, mutate func(*model.Config)) *healthcheck.Snapshot {
	s := configSnapshot(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates = states
		if mutate != nil {
			mutate(cfg)
		}
	})
	if plugins != nil {
		s.Plugins = plugins
		s.Sections[model.SectionPlugins] = nil
	}
	return s
}

func TestPluginRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{pluginsOff, pluginHealthOff, pluginNotRunning}
	notRunning := func(ids string) want {
		return firing("health.rule.plugin_not_running.message", map[string]string{"plugins": ids})
	}
	pluginsDisabled := func(cfg *model.Config) {
		cfg.PluginSettings.Enable = new(false)
	}
	allResolved := map[string]want{"PLUGINS_OFF": resolved, "PLUGIN_HEALTH_OFF": resolved, "PLUGIN_NOT_RUNNING": resolved}
	notRunningOnly := func(w want) map[string]want {
		return map[string]want{"PLUGINS_OFF": resolved, "PLUGIN_HEALTH_OFF": resolved, "PLUGIN_NOT_RUNNING": w}
	}

	failed := pluginSnapshot(map[string]*model.PluginState{callsID: {Enable: true}}, pluginList(nil, []string{callsID}), nil)
	failed.Sections[model.SectionPlugins] = errors.New("boom")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "config section absent",
			snapshot: &healthcheck.Snapshot{Plugins: pluginList(nil, nil), Sections: map[model.WorkspaceSection]error{model.SectionPlugins: nil}},
			want:     map[string]want{"PLUGINS_OFF": configUnknown, "PLUGIN_HEALTH_OFF": configUnknown, "PLUGIN_NOT_RUNNING": configUnknown},
		},
		{
			name:     "defaults with no plugins",
			snapshot: pluginSnapshot(nil, pluginList(nil, nil), nil),
			want:     allResolved,
		},
		{
			name: "plugins and health check off",
			snapshot: pluginSnapshot(nil, nil, all(pluginsDisabled, func(cfg *model.Config) {
				cfg.PluginSettings.EnableHealthCheck = new(false)
			})),
			want: map[string]want{"PLUGINS_OFF": firing("health.rule.plugins_off.message", nil), "PLUGIN_HEALTH_OFF": resolved, "PLUGIN_NOT_RUNNING": resolved},
		},
		{
			name:     "plugins off with an enabled plugin in the disabled list",
			snapshot: pluginSnapshot(map[string]*model.PluginState{callsID: {Enable: true}}, pluginList(nil, []string{callsID}), pluginsDisabled),
			want:     map[string]want{"PLUGINS_OFF": firing("health.rule.plugins_off.message", nil), "PLUGIN_HEALTH_OFF": resolved, "PLUGIN_NOT_RUNNING": resolved},
		},
		{
			name: "health check off",
			snapshot: pluginSnapshot(nil, pluginList(nil, nil), func(cfg *model.Config) {
				cfg.PluginSettings.EnableHealthCheck = new(false)
			}),
			want: map[string]want{"PLUGINS_OFF": resolved, "PLUGIN_HEALTH_OFF": firing("health.rule.plugin_health_off.message", nil), "PLUGIN_NOT_RUNNING": resolved},
		},
		{
			name: "health check flag unreadable",
			snapshot: pluginSnapshot(nil, pluginList(nil, nil), func(cfg *model.Config) {
				cfg.PluginSettings.EnableHealthCheck = nil
			}),
			want: map[string]want{"PLUGINS_OFF": resolved, "PLUGIN_HEALTH_OFF": configUnknown, "PLUGIN_NOT_RUNNING": resolved},
		},
		{
			name: "plugins flag unreadable",
			snapshot: pluginSnapshot(nil, pluginList(nil, nil), func(cfg *model.Config) {
				cfg.PluginSettings.Enable = nil
			}),
			want: map[string]want{"PLUGINS_OFF": configUnknown, "PLUGIN_HEALTH_OFF": configUnknown, "PLUGIN_NOT_RUNNING": configUnknown},
		},
		{
			name:     "enabled plugin in the disabled list",
			snapshot: pluginSnapshot(map[string]*model.PluginState{callsID: {Enable: true}}, pluginList(nil, []string{callsID}), nil),
			want:     notRunningOnly(notRunning(callsID)),
		},
		{
			name: "every enabled plugin that is not running is listed, sorted",
			snapshot: pluginSnapshot(
				map[string]*model.PluginState{jiraID: {Enable: true}, gitlabID: {Enable: true}, callsID: {Enable: true}},
				pluginList([]string{callsID}, []string{jiraID, gitlabID}),
				nil,
			),
			want: notRunningOnly(notRunning(gitlabID + ", " + jiraID)),
		},
		{
			name:     "enabled plugin that is running",
			snapshot: pluginSnapshot(map[string]*model.PluginState{callsID: {Enable: true}}, pluginList([]string{callsID}, nil), nil),
			want:     allResolved,
		},
		{
			name:     "plugin disabled in config and in the disabled list",
			snapshot: pluginSnapshot(map[string]*model.PluginState{gitlabID: {Enable: false}}, pluginList(nil, []string{gitlabID}), nil),
			want:     allResolved,
		},
		{
			name:     "plugin in the disabled list with no state entry",
			snapshot: pluginSnapshot(nil, pluginList(nil, []string{gitlabID}), nil),
			want:     allResolved,
		},
		{
			name:     "nil state entry",
			snapshot: pluginSnapshot(map[string]*model.PluginState{gitlabID: nil}, pluginList(nil, []string{gitlabID}), nil),
			want:     allResolved,
		},
		{
			name:     "enabled in config but uninstalled",
			snapshot: pluginSnapshot(map[string]*model.PluginState{jiraID: {Enable: true}}, pluginList([]string{callsID}, []string{gitlabID}), nil),
			want:     allResolved,
		},
		{
			name:     "plugin list absent",
			snapshot: pluginSnapshot(map[string]*model.PluginState{callsID: {Enable: true}}, nil, nil),
			want:     notRunningOnly(want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonPluginsUnavailable}),
		},
		{
			name:     "plugin list failed",
			snapshot: failed,
			want:     notRunningOnly(want{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonPluginsUnavailable}),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertRules(t, rules, tc.snapshot, tc.want)
		})
	}
}
