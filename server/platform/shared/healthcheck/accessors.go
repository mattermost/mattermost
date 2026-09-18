// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
)

var collectedJobTypes = []string{
	model.JobTypeLdapSync,
	model.JobTypeDataRetention,
	model.JobTypeMessageExport,
	model.JobTypeElasticsearchPostIndexing,
	model.JobTypeElasticsearchPostAggregation,
	model.JobTypeMigrations,
}

func (s *Snapshot) ConfigString(get func(*model.Config) *string) (string, bool) {
	if get == nil || !s.Has(model.SectionConfig) || s.Config == nil || s.Config.Config == nil {
		return "", false
	}

	value := get(s.Config.Config)
	if value == nil || *value == model.FakeSetting {
		return "", false
	}

	return *value, true
}

func (s *Snapshot) ConfigBool(get func(*model.Config) *bool) (bool, bool) {
	if get == nil || !s.Has(model.SectionConfig) || s.Config == nil || s.Config.Config == nil {
		return false, false
	}

	value := get(s.Config.Config)
	if value == nil {
		return false, false
	}

	return *value, true
}

func (s *Snapshot) ConfigInt(get func(*model.Config) *int) (int, bool) {
	if get == nil || !s.Has(model.SectionConfig) || s.Config == nil || s.Config.Config == nil {
		return 0, false
	}

	value := get(s.Config.Config)
	if value == nil {
		return 0, false
	}

	return *value, true
}

func (s *Snapshot) DataSource() (string, bool) {
	return s.ConfigString(func(cfg *model.Config) *string {
		return cfg.SqlSettings.DataSource
	})
}

func (s *Snapshot) JobsFor(jobType string) ([]*model.Job, bool) {
	if !s.Has(model.SectionJobs) || s.Jobs == nil || !isCollectedJobType(jobType) {
		return nil, false
	}

	switch jobType {
	case model.JobTypeLdapSync:
		return s.Jobs.LDAPSyncJobs, true
	case model.JobTypeDataRetention:
		return s.Jobs.DataRetentionJobs, true
	case model.JobTypeMessageExport:
		return s.Jobs.MessageExportJobs, true
	case model.JobTypeElasticsearchPostIndexing:
		return s.Jobs.ElasticPostIndexingJobs, true
	case model.JobTypeElasticsearchPostAggregation:
		return s.Jobs.ElasticPostAggregationJobs, true
	case model.JobTypeMigrations:
		return s.Jobs.MigrationJobs, true
	default:
		return nil, false
	}
}

func CollectedJobTypes() []string {
	jobTypes := make([]string, len(collectedJobTypes))
	copy(jobTypes, collectedJobTypes)
	return jobTypes
}

func (s *Snapshot) LicenseFeature(get func(*model.Features) *bool) (bool, bool) {
	if get == nil || s == nil || s.License == nil || s.License.Features == nil {
		return false, false
	}

	value := get(s.License.Features)
	if value == nil {
		return false, false
	}

	return *value, true
}

func (s *Snapshot) PluginEnabled(id string) (bool, bool) {
	if !s.Has(model.SectionPlugins) || s == nil || s.Plugins == nil {
		return false, false
	}

	for _, manifest := range s.Plugins.Enabled {
		if manifest.Id == id {
			return true, true
		}
	}

	for _, manifest := range s.Plugins.Disabled {
		if manifest.Id == id {
			return false, true
		}
	}

	return false, false
}

func isCollectedJobType(jobType string) bool {
	return slices.Contains(collectedJobTypes, jobType)
}
