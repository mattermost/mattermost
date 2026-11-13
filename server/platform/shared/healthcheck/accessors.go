// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"slices"
	"time"

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
	value, ok := configValue(s, get)
	if !ok || value == model.FakeSetting {
		return "", false
	}

	return value, true
}

func (s *Snapshot) ConfigBool(get func(*model.Config) *bool) (bool, bool) {
	return configValue(s, get)
}

func (s *Snapshot) ConfigInt(get func(*model.Config) *int) (int, bool) {
	return configValue(s, get)
}

func (s *Snapshot) ConfigInt64(get func(*model.Config) *int64) (int64, bool) {
	return configValue(s, get)
}

// ConfigRoot returns the whole config for fields the scalar accessors don't cover; unlike ConfigString it
// does not hide redacted values.
func (s *Snapshot) ConfigRoot() (*model.Config, bool) {
	if !s.Has(model.SectionConfig) || s.Config == nil || s.Config.Config == nil {
		return nil, false
	}

	return s.Config.Config, true
}

// configValue returns ok=false when the config section is absent or the field is nil.
// TODO: make this a generic method on Snapshot once the module targets Go 1.27.
func configValue[T any](s *Snapshot, get func(*model.Config) *T) (T, bool) {
	var zero T
	cfg, ok := s.ConfigRoot()
	if get == nil || !ok {
		return zero, false
	}

	value := get(cfg)
	if value == nil {
		return zero, false
	}

	return *value, true
}

// Stat returns a workspace stat, or ok=false when stats were not collected or the query for this stat failed.
func (s *Snapshot) Stat(get func(*model.SupportPacketStats) *int64) (int64, bool) {
	if get == nil || s == nil || s.Stats == nil {
		return 0, false
	}

	value := get(s.Stats)
	if value == nil {
		return 0, false
	}

	return *value, true
}

func (s *Snapshot) ClusterEnabled() (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.Enable })
}

func (s *Snapshot) RegisteredUsers() (int64, bool) {
	return s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.RegisteredUsers })
}

// Since measures from CollectedAt, not now, so a packet read later reports what was true then.
// ok is false when the collection time is unknown.
func (s *Snapshot) Since(t time.Time) (time.Duration, bool) {
	if s.CollectedAt.IsZero() {
		return 0, false
	}

	return s.CollectedAt.Sub(t), true
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

// LeaderDiag returns the leader's diagnostics, or ok=false when they were not collected or section recorded an error.
func (s *Snapshot) LeaderDiag(section model.NodeSection) (*model.SupportPacketDiagnostics, bool) {
	leader, ok := s.Leader()
	if !ok {
		return nil, false
	}

	return leader.SectionDiag(section)
}

// License reads the leader's diagnostics so live and packet snapshots see the same license fields.
func (s *Snapshot) License() (*model.SupportPacketLicense, bool) {
	diag, ok := s.LeaderDiag(model.SectionLicense)
	if !ok {
		return nil, false
	}

	return &diag.License, true
}

// IsCloud is false when the license is unavailable.
func (s *Snapshot) IsCloud() bool {
	license, ok := s.License()
	return ok && license.IsCloud
}

// LicenseSeats returns the licensed seat count, or ok=false when there is no license or it
// sets no positive seat count.
func (s *Snapshot) LicenseSeats() (int, bool) {
	license, ok := s.License()
	if !ok || license.Users <= 0 {
		return 0, false
	}

	return license.Users, true
}

// LicenseExpiresAt returns when the license expires, or ok=false when there is no license or
// no expiry is recorded, as in older Support Packets.
func (s *Snapshot) LicenseExpiresAt() (time.Time, bool) {
	license, ok := s.License()
	if !ok || license.ExpiresAt == 0 {
		return time.Time{}, false
	}

	return time.UnixMilli(license.ExpiresAt).UTC(), true
}

// LicenseFeature reports false for an unlicensed server, which carries no features, and unknown for a licensed packet that predates them.
func (s *Snapshot) LicenseFeature(get func(*model.Features) *bool) (bool, bool) {
	license, ok := s.License()
	if !ok || get == nil {
		return false, false
	}
	if license.Features == nil {
		return false, license.SkuShortName == ""
	}

	value := get(license.Features)
	if value == nil {
		return false, false
	}

	return *value, true
}

// LicenseAllows reports whether the server may use feature, with ok=false only when the license was not
// collected. Unlike LicenseFeature, a licensed packet that does not record the feature counts as allowed, so
// packets from servers that predate the feature list keep their findings.
func (s *Snapshot) LicenseAllows(feature func(*model.Features) *bool) (allowed, ok bool) {
	license, ok := s.License()
	switch {
	case !ok || feature == nil:
		return false, false
	case license.Features == nil:
		// Matches LicenseFeature: an unlicensed server records neither a SKU nor features.
		return license.SkuShortName != "", true
	}

	value := feature(license.Features)
	return value == nil || *value, true
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
