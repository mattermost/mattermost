// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"os"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/featureflag"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// setupFeatureFlags called on startup and when the cluster leader changes.
// Starts or stops the synchronization of feature flags from upstream management.
func (ps *PlatformService) setupFeatureFlags() {
	ps.featureFlagSynchronizerMutex.Lock()
	defer ps.featureFlagSynchronizerMutex.Unlock()
	splitKey := *ps.Config().ServiceSettings.SplitKey
	splitConfigured := splitKey != ""
	syncFeatureFlags := splitConfigured && ps.IsLeader()

	ps.configStore.SetReadOnlyFF(!splitConfigured)

	if syncFeatureFlags {
		if err := ps.startFeatureFlagUpdateJob(); err != nil {
			mlog.Warn("Unable to setup synchronization with feature flag management. Will fallback to cache.", mlog.Err(err))
		}
	} else {
		ps.stopFeatureFlagUpdateJob()
	}

	if err := ps.configStore.Load(); err != nil {
		mlog.Warn("Unable to load config store after feature flag setup.", mlog.Err(err))
	}
}

func (ps *PlatformService) updateFeatureFlagValuesFromManagement() {
	newCfg := ps.configStore.GetNoEnv().Clone()
	oldFlags := *newCfg.FeatureFlags
	newFlags := ps.featureFlagSynchronizer.UpdateFeatureFlagValues(oldFlags)
	oldFlagsBytes, _ := json.Marshal(oldFlags)
	newFlagsBytes, _ := json.Marshal(newFlags)
	mlog.Debug("Checking feature flags from management service", mlog.String("old_flags", string(oldFlagsBytes)), mlog.String("new_flags", string(newFlagsBytes)))
	if oldFlags != newFlags {
		mlog.Debug("Feature flag change detected, updating config")
		*newCfg.FeatureFlags = newFlags
		ps.SaveConfig(newCfg, true)
	}
}

func (ps *PlatformService) startFeatureFlagUpdateJob() error {
	// Can be run multiple times
	if ps.featureFlagSynchronizer != nil {
		return nil
	}

	var log *mlog.Logger
	if *ps.Config().ServiceSettings.DebugSplit {
		var err error
		// TODO: Add split logging functionality back and probably use PlatformService.Logger once added.
		log, err = mlog.NewLogger()
		if err != nil {
			return err
		}
	}

	attributes := map[string]any{}

	// if we are part of a cloud installation, add its installation and group id
	if installationId := os.Getenv("MM_CLOUD_INSTALLATION_ID"); installationId != "" {
		attributes["installation_id"] = installationId
	}
	if groupId := os.Getenv("MM_CLOUD_GROUP_ID"); groupId != "" {
		attributes["group_id"] = groupId
	}

	synchronizer, err := featureflag.NewSynchronizer(featureflag.SyncParams{
		ServerID:   ps.TelemetryId(),
		SplitKey:   *ps.Config().ServiceSettings.SplitKey,
		Log:        log,
		Attributes: attributes,
	})
	if err != nil {
		return err
	}

	ps.featureFlagStop = make(chan struct{})
	ps.featureFlagStopped = make(chan struct{})
	ps.featureFlagSynchronizer = synchronizer
	syncInterval := *ps.Config().ServiceSettings.FeatureFlagSyncIntervalSeconds

	go func() {
		ticker := time.NewTicker(time.Duration(syncInterval) * time.Second)
		defer ticker.Stop()
		defer close(ps.featureFlagStopped)
		if err := synchronizer.EnsureReady(); err != nil {
			mlog.Warn("Problem connecting to feature flag management. Will fallback to cloud cache.", mlog.Err(err))
			return
		}
		ps.updateFeatureFlagValuesFromManagement()
		for {
			select {
			case <-ps.featureFlagStop:
				return
			case <-ticker.C:
				ps.updateFeatureFlagValuesFromManagement()
			}
		}
	}()

	return nil
}

func (s *PlatformService) stopFeatureFlagUpdateJob() {
	if s.featureFlagSynchronizer != nil {
		close(s.featureFlagStop)
		<-s.featureFlagStopped
		s.featureFlagSynchronizer.Close()
		s.featureFlagSynchronizer = nil
	}
}
