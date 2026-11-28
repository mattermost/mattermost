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

// NodeLocalConfigPaths are settings cluster nodes may set differently on purpose. FlattenConfig
// leaves them out, along with every setting below them.
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

// FlattenConfig maps each setting of a sanitized config, such as "TeamSettings.SiteName", to its
// JSON value, leaving out the NodeLocalConfigPaths. Secrets are masked, so only whether one is set
// can differ. It returns nil when there is no config.
func FlattenConfig(cfg *model.SupportPacketConfig) map[string]string {
	if cfg == nil || cfg.Config == nil {
		return nil
	}

	// Going through JSON takes FeatureFlags from SupportPacketConfig's own field, which hides the
	// embedded one.
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

// flattenSetting records every leaf below value. Lists are leaves; empty objects record nothing.
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
