// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigStringAndDataSourceFakeSettingGuard(t *testing.T) {
	t.Parallel()

	t.Run("mysql sanitization yields unavailable config string", func(t *testing.T) {
		cfg := &model.Config{}
		cfg.SqlSettings.DriverName = new("mysql")
		cfg.SqlSettings.DataSource = new("mysql://mmuser:secret@tcp(db.example.com:3306)/mattermost")
		cfg.Sanitize(nil, &model.SanitizeOptions{PartiallyRedactDataSources: true})

		snapshot := &Snapshot{
			Config:   &model.SupportPacketConfig{Config: cfg},
			Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
		}

		_, ok := snapshot.ConfigString(func(config *model.Config) *string { return config.SqlSettings.DataSource })
		require.False(t, ok)

		_, ok = snapshot.DataSource()
		require.False(t, ok)
	})

	t.Run("postgres partial redact keeps host and remains readable", func(t *testing.T) {
		cfg := &model.Config{}
		cfg.SqlSettings.DriverName = new(model.DatabaseDriverPostgres)
		cfg.SqlSettings.DataSource = new("postgres://mmuser:secret@db.example.com:5432/mattermost?sslmode=disable&connect_timeout=10")
		cfg.Sanitize(nil, &model.SanitizeOptions{PartiallyRedactDataSources: true})

		snapshot := &Snapshot{
			Config:   &model.SupportPacketConfig{Config: cfg},
			Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
		}

		dsn, ok := snapshot.DataSource()
		require.True(t, ok)
		require.Contains(t, dsn, "****:****")
		require.Contains(t, dsn, "db.example.com:5432")
	})
}

func TestJobsForOutsideCollectedSetReturnsUnavailable(t *testing.T) {
	t.Parallel()

	snapshot := &Snapshot{
		Jobs:     &model.SupportPacketJobList{},
		Sections: map[model.WorkspaceSection]error{model.SectionJobs: nil},
	}

	jobs, ok := snapshot.JobsFor(model.JobTypeExpiryNotify)
	require.False(t, ok)
	require.Nil(t, jobs)
}

func TestAccessorsReturnFalseWhenSectionAbsent(t *testing.T) {
	t.Parallel()

	cfg := &model.Config{}
	cfg.SqlSettings.Trace = new(true)
	cfg.SqlSettings.MaxOpenConns = new(25)

	snapshot := &Snapshot{
		Config:   &model.SupportPacketConfig{Config: cfg},
		Jobs:     &model.SupportPacketJobList{},
		Plugins:  &model.SupportPacketPluginList{},
		Sections: map[model.WorkspaceSection]error{},
	}

	_, ok := snapshot.ConfigString(func(config *model.Config) *string { return config.SqlSettings.DriverName })
	require.False(t, ok)
	_, ok = snapshot.ConfigBool(func(config *model.Config) *bool { return config.SqlSettings.Trace })
	require.False(t, ok)
	_, ok = snapshot.ConfigInt(func(config *model.Config) *int { return config.SqlSettings.MaxOpenConns })
	require.False(t, ok)
	_, ok = snapshot.DataSource()
	require.False(t, ok)
	_, ok = snapshot.JobsFor(model.JobTypeLdapSync)
	require.False(t, ok)
	_, ok = snapshot.PluginEnabled("com.mattermost.calls")
	require.False(t, ok)
}

func TestLicenseFeature(t *testing.T) {
	t.Parallel()

	ldap := func(f *model.Features) *bool { return f.LDAP }

	t.Run("nil snapshot", func(t *testing.T) {
		var s *Snapshot
		_, ok := s.LicenseFeature(ldap)
		require.False(t, ok)
	})

	t.Run("nil license", func(t *testing.T) {
		_, ok := (&Snapshot{}).LicenseFeature(ldap)
		require.False(t, ok)
	})

	t.Run("nil features", func(t *testing.T) {
		s := &Snapshot{License: &model.License{}}
		_, ok := s.LicenseFeature(ldap)
		require.False(t, ok)
	})

	t.Run("nil getter", func(t *testing.T) {
		s := &Snapshot{License: &model.License{Features: &model.Features{}}}
		_, ok := s.LicenseFeature(nil)
		require.False(t, ok)
	})

	t.Run("unset feature value", func(t *testing.T) {
		s := &Snapshot{License: &model.License{Features: &model.Features{}}}
		_, ok := s.LicenseFeature(ldap)
		require.False(t, ok)
	})

	t.Run("feature enabled", func(t *testing.T) {
		s := &Snapshot{License: &model.License{Features: &model.Features{LDAP: model.NewPointer(true)}}}
		value, ok := s.LicenseFeature(ldap)
		require.True(t, ok)
		require.True(t, value)
	})

	t.Run("feature disabled", func(t *testing.T) {
		s := &Snapshot{License: &model.License{Features: &model.Features{LDAP: model.NewPointer(false)}}}
		value, ok := s.LicenseFeature(ldap)
		require.True(t, ok)
		require.False(t, value)
	})
}

func TestPluginEnabled(t *testing.T) {
	t.Parallel()

	newSnapshot := func() *Snapshot {
		return &Snapshot{
			Sections: map[model.WorkspaceSection]error{model.SectionPlugins: nil},
			Plugins: &model.SupportPacketPluginList{
				Enabled:  []model.Manifest{{Id: "com.enabled"}},
				Disabled: []model.Manifest{{Id: "com.disabled"}},
			},
		}
	}

	t.Run("enabled plugin", func(t *testing.T) {
		enabled, ok := newSnapshot().PluginEnabled("com.enabled")
		require.True(t, ok)
		require.True(t, enabled)
	})

	t.Run("disabled plugin", func(t *testing.T) {
		enabled, ok := newSnapshot().PluginEnabled("com.disabled")
		require.True(t, ok)
		require.False(t, enabled)
	})

	t.Run("unknown plugin", func(t *testing.T) {
		_, ok := newSnapshot().PluginEnabled("com.unknown")
		require.False(t, ok)
	})
}

func TestStat(t *testing.T) {
	t.Parallel()

	t.Run("nil stats", func(t *testing.T) {
		s := &Snapshot{}
		_, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 {
			return stats.Teams
		})
		require.False(t, ok)
	})

	t.Run("nil field", func(t *testing.T) {
		s := &Snapshot{Stats: &model.SupportPacketStats{}}
		_, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 {
			return stats.Teams
		})
		require.False(t, ok)
	})

	t.Run("pointer to zero", func(t *testing.T) {
		s := &Snapshot{
			Stats: &model.SupportPacketStats{Teams: new(int64)},
		}

		value, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 {
			return stats.Teams
		})
		require.True(t, ok)
		require.Equal(t, int64(0), value)
	})

	t.Run("section error still returns populated field", func(t *testing.T) {
		s := &Snapshot{
			Stats: &model.SupportPacketStats{Teams: new(int64(9))},
			Sections: map[model.WorkspaceSection]error{
				model.SectionStats: assert.AnError,
			},
		}

		value, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 {
			return stats.Teams
		})
		require.True(t, ok)
		require.Equal(t, int64(9), value)
	})
}
