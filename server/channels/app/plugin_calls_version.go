// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/Masterminds/semver/v3"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// Calls ships in two major versions under the same plugin ID: v1 (1.x, RTCD) and v2 (2.x,
// LiveKit). Both bundles may be prepackaged at the same time, and PluginSettings.CallsVersion
// chooses which one is installed.

// callsVersionFromPluginVersion maps a Calls plugin version to PluginCallsVersionV1 or
// PluginCallsVersionV2. Unparseable versions are treated as v1, the legacy line.
func callsVersionFromPluginVersion(version string) string {
	v, err := semver.StrictNewVersion(version)
	if err != nil || v.Major() < 2 {
		return model.PluginCallsVersionV1
	}
	return model.PluginCallsVersionV2
}

// resolveCallsVersion returns the value to use for an empty CallsVersion setting. installed is
// the Calls manifest currently unpacked locally, or nil if Calls is not installed. A server
// already running a Calls version stays on it; with nothing installed this is most likely a
// fresh install, which starts on v2.
func resolveCallsVersion(installed *model.Manifest) string {
	if installed == nil {
		return model.PluginCallsVersionV2
	}
	return callsVersionFromPluginVersion(installed.Version)
}

// selectCallsBundle picks which of the prepackaged Calls manifests to install for the wanted
// version, falling back to the other version if the wanted one is not prepackaged. It returns
// nil if there are no candidates.
func selectCallsBundle(wanted string, candidates []*model.Manifest, logger *mlog.Logger) *model.Manifest {
	best := func(version string) *model.Manifest {
		var found *model.Manifest
		var foundVersion *semver.Version
		for _, m := range candidates {
			if callsVersionFromPluginVersion(m.Version) != version {
				continue
			}
			v, err := semver.StrictNewVersion(m.Version)
			if err != nil {
				if found == nil {
					found = m
				}
				continue
			}
			if foundVersion == nil || v.GreaterThan(foundVersion) {
				found, foundVersion = m, v
			}
		}
		return found
	}

	if m := best(wanted); m != nil {
		return m
	}

	other := model.PluginCallsVersionV1
	if wanted == model.PluginCallsVersionV1 {
		other = model.PluginCallsVersionV2
	}
	if m := best(other); m != nil {
		logger.Warn("Prepackaged Calls bundle for the configured version not found, using the other version",
			mlog.String("calls_version", wanted), mlog.String("fallback_calls_version", other), mlog.String("version", m.Version))
		return m
	}
	return nil
}

// callsInstallStrategy decides how to install the chosen Calls bundle given what is installed.
// A switch between v1 and v2 must install even though it may be a downgrade; otherwise the
// usual "only if new or upgrade" applies, so an already installed (possibly newer) bundle of the
// same version is left alone. If the installed Calls was installed manually (it is in the file
// store), the setting must not overwrite it, so it returns false.
func callsInstallStrategy(chosen, installed *model.Manifest, installedIsManual bool) (pluginInstallationStrategy, bool) {
	if installed == nil || callsVersionFromPluginVersion(installed.Version) == callsVersionFromPluginVersion(chosen.Version) {
		return installPluginLocallyOnlyIfNewOrUpgrade, true
	}
	if installedIsManual {
		return 0, false
	}
	return installPluginLocallyAlways, true
}

// ensureCallsVersion returns the effective CallsVersion, resolving and persisting it first if
// the setting is empty. installed is the Calls manifest unpacked locally, or nil.
func (ch *Channels) ensureCallsVersion(installed *model.Manifest) string {
	if v := *ch.cfgSvc.Config().PluginSettings.CallsVersion; v != "" {
		return v
	}

	resolved := resolveCallsVersion(installed)
	ch.srv.Log().Info("Resolved empty Calls version setting", mlog.String("calls_version", resolved))
	ch.cfgSvc.UpdateConfig(func(cfg *model.Config) {
		if *cfg.PluginSettings.CallsVersion == "" {
			cfg.PluginSettings.CallsVersion = new(resolved)
		}
	})
	return resolved
}
