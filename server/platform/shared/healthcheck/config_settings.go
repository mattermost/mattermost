// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"encoding/json"
	"maps"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// NodeLocalConfigPaths are config settings that cluster nodes may set differently on purpose,
// so FlattenConfig leaves them out: RunJobs and RunScheduler choose which nodes run jobs, and
// the addresses and hostname identify the node itself. A path also covers every setting below it.
var NodeLocalConfigPaths = []string{
	"JobSettings.RunJobs",
	"JobSettings.RunScheduler",
	"ClusterSettings.OverrideHostname",
	"ClusterSettings.NetworkInterface",
	"ClusterSettings.BindAddress",
	"ClusterSettings.AdvertiseAddress",
	"ServiceSettings.ListenAddress",
	"MetricsSettings.ListenAddress",
}

// FlattenConfig maps each setting of a node's sanitized config, such as "TeamSettings.SiteName",
// to its JSON value, leaving out the NodeLocalConfigPaths. Plugin settings become paths below
// "PluginSettings.Plugins.<plugin id>". It returns nil when there is no config.
//
// The health check compares the result across nodes to detect config drift. Live, each node sends
// its config with its diagnostics; offline, the packet reader reads each node's
// sanitized_config.json. Both arrive as JSON, so both are flattened the same way. The config is
// sanitized, so secret values never count as drift; whether a secret is set does.
func FlattenConfig(cfg *model.SupportPacketConfig) map[string]string {
	if cfg == nil || cfg.Config == nil {
		return nil
	}

	// Going through JSON makes a config decoded from JSON and one built in memory flatten alike,
	// and takes FeatureFlags from SupportPacketConfig's own field, which hides the embedded one.
	data, err := json.Marshal(cfg)
	if err != nil {
		return nil
	}
	var tree map[string]any
	if err := json.Unmarshal(data, &tree); err != nil {
		return nil
	}

	settings := map[string]string{}
	flattenSetting(settings, "", tree)
	for path := range settings {
		if isNodeLocal(path) {
			delete(settings, path)
		}
	}
	return settings
}

// flattenSetting records every leaf below value. Lists are leaves. An object without keys records
// nothing, so a plugin with no settings matches one that has no entry.
func flattenSetting(into map[string]string, path string, value any) {
	if object, ok := value.(map[string]any); ok {
		for key, child := range object {
			childPath := key
			if path != "" {
				childPath = path + "." + key
			}
			flattenSetting(into, childPath, child)
		}
		return
	}

	encoded, err := json.Marshal(value)
	if err != nil {
		return
	}
	into[path] = string(encoded)
}

func isNodeLocal(path string) bool {
	for _, local := range NodeLocalConfigPaths {
		if path == local || strings.HasPrefix(path, local+".") {
			return true
		}
	}
	return false
}

// DifferingSettings adds to into the paths whose values differ between two flattened configs,
// including paths only one of them has.
func DifferingSettings(into map[string]bool, a, b map[string]string) {
	for path, value := range a {
		if other, ok := b[path]; !ok || other != value {
			into[path] = true
		}
	}
	for path := range b {
		if _, ok := a[path]; !ok {
			into[path] = true
		}
	}
}

// ConfigKey identifies a flattened config, so equal configs get equal keys.
func ConfigKey(settings map[string]string) string {
	// encoding/json sorts map keys and escapes every string, so the encoding is canonical.
	key, _ := json.Marshal(settings)
	return string(key)
}

// SortedSettings lists the paths of a DifferingSettings result in order.
func SortedSettings(paths map[string]bool) []string {
	return slices.Sorted(maps.Keys(paths))
}
