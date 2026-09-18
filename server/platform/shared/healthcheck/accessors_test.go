// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
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
