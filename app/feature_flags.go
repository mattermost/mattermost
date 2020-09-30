// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
)

// setupFeatureFlags called on startup and when the cluster leader changes.
// starts or stops the syncronization of feature flags from upstream managment.
func (s *Server) setupFeatureFlags() {
	license := s.License()
	inCloud := license != nil && *license.Features.Cloud
	splitKey := *s.Config().ServiceSettings.SplitKey
	syncFeatureFlags := inCloud && splitKey != "" && s.IsLeader()

	if inCloud {
		s.configStore.PersistFeatures(true)
	} else {
		s.configStore.PersistFeatures(false)
	}

	if syncFeatureFlags {
		if err := s.startFeatureFlagUpdateJob(); err != nil {
			s.Log.Error("Unable to setup synchronization with feature flag management. Will fallback to cloud cache.", mlog.Err(err))
		}
	} else {
		s.stopFeatureFlagUpdateJob()
	}

	if err := s.configStore.Load(); err != nil {
		s.Log.Error("Unable to load config store after feature flag setup.", mlog.Err(err))
	}
}

func (s *Server) updateFeatureFlagValuesFromManagment() {
	newCfg := s.configStore.GetNoEnv().Clone()
	oldFlags := *newCfg.FeatureFlags
	newFlags := s.featureFlagSynchronizer.UpdateFeatureFlagValues(oldFlags)
	if oldFlags != newFlags {
		*newCfg.FeatureFlags = newFlags
		s.SaveConfig(newCfg, true)
	}
}

func (s *Server) startFeatureFlagUpdateJob() error {
	// Can be run multiple times
	if s.featureFlagSynchronizer != nil {
		return nil
	}

	var log *mlog.Logger
	if *s.Config().ServiceSettings.DebugSplit {
		log = s.Log
	}

	syncronizer, err := config.NewFeatureFlagSynchronizer(config.FeatureFlagSyncParams{
		ServerID: s.TelemetryId(),
		SplitKey: *s.Config().ServiceSettings.SplitKey,
		Log:      log,
	})
	if err != nil {
		return err
	}

	s.featureFlagStop = make(chan struct{})
	s.featureFlagStopped = make(chan struct{})
	s.featureFlagSynchronizer = syncronizer
	syncInterval := *s.Config().ServiceSettings.FeatureFlagSyncIntervalSeconds

	go func() {
		defer close(s.featureFlagStopped)
		if err := syncronizer.EnsureReady(); err != nil {
			s.Log.Error("Problem connecting to feature flag managment. Will fallback to cloud cache.", mlog.Err(err))
			return
		}
		s.updateFeatureFlagValuesFromManagment()
		for {
			select {
			case <-s.featureFlagStop:
				return
			case <-time.After(time.Duration(syncInterval) * time.Second):
				s.updateFeatureFlagValuesFromManagment()
			}
		}
	}()

	return nil
}

func (s *Server) stopFeatureFlagUpdateJob() {
	if s.featureFlagSynchronizer != nil {
		close(s.featureFlagStop)
		<-s.featureFlagStopped
		s.featureFlagSynchronizer.Close()
		s.featureFlagSynchronizer = nil
	}
}
