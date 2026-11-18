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

// effectiveCallsVersion returns the Calls version to install: the CallsVersion setting if it is
// set, otherwise v1 while a v1 bundle is prepackaged and v2 after that. v1 is the default because
// it works without any extra infrastructure, whereas v2 does not work until LiveKit is configured,
// so a wrong guess toward v2 breaks calling while a wrong guess toward v1 costs an admin one
// setting change. The default is computed from the bundles this server ships each time and is
// never written to the config.
func effectiveCallsVersion(setting string, candidates []*model.Manifest) string {
	if setting != "" {
		return setting
	}
	for _, m := range candidates {
		if callsVersionFromPluginVersion(m.Version) == model.PluginCallsVersionV1 {
			return model.PluginCallsVersionV1
		}
	}
	return model.PluginCallsVersionV2
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

// chooseCallsBundle picks which of the prepackaged Calls bundles to install and how. candidates
// are the manifests of the prepackaged Calls bundles and installed is the Calls manifest that is
// installed now, or nil. It returns the chosen manifest (nil if there are no candidates), the
// installation strategy, and whether to install at all. The defaults are the ones every other
// prepackaged plugin gets: install if new or an upgrade.
func (ch *Channels) chooseCallsBundle(candidates []*model.Manifest, installed *model.Manifest, logger *mlog.Logger) (*model.Manifest, pluginInstallationStrategy, bool) {
	strategy := installPluginLocallyOnlyIfNewOrUpgrade
	install := true
	if len(candidates) == 0 {
		return nil, strategy, install
	}

	setting := *ch.cfgSvc.Config().PluginSettings.CallsVersion
	wanted := effectiveCallsVersion(setting, candidates)
	if setting == "" {
		logger.Info("The Calls version setting is empty, using the default", mlog.String("calls_version", wanted))
	}
	chosen := selectCallsBundle(wanted, candidates, logger)

	if installed != nil && chosen != nil {
		// A Calls bundle uploaded by an admin lives in the file store; prepackaged ones don't.
		manual, appErr := ch.srv.fileExists(getBundleStorePath(model.PluginIdCalls))
		if appErr != nil {
			// Fail closed: without knowing, don't overwrite what may be an admin's upload.
			logger.Warn("Failed to check for a manually installed Calls plugin, assuming it is one", mlog.Err(appErr))
			manual = true
		}
		strategy, install = callsInstallStrategy(chosen, installed, manual)
		if !install {
			logger.Info("Not switching Calls version: Calls was installed manually", mlog.String("calls_version", wanted))
		}
	}

	return chosen, strategy, install
}

// callsEnabled reports whether the Calls plugin is enabled in the given config.
func callsEnabled(cfg *model.Config) bool {
	state := cfg.PluginSettings.PluginStates[model.PluginIdCalls]
	return state != nil && state.Enable
}

// callsVersionNeedsReeval reports whether a config change should re-run the prepackaged plugin
// selection so the chosen Calls bundle is installed: when CallsVersion changes, or when Calls is
// enabled, which applies a version chosen while Calls was disabled and nothing could be installed.
// Pre-packaged plugins are otherwise only processed at startup. The re-run is idempotent, so a
// change that leaves the effective version unchanged installs nothing.
func callsVersionNeedsReeval(oldCfg, newCfg *model.Config) bool {
	if *newCfg.PluginSettings.CallsVersion != *oldCfg.PluginSettings.CallsVersion {
		return true
	}
	return callsEnabled(newCfg) && !callsEnabled(oldCfg)
}
