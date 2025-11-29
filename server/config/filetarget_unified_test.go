// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestMakeFileTarget(t *testing.T) {
	cfg, err := makeFileTarget("/tmp/audit.log", "error", true, 5, 7, 2, true)
	require.NoError(t, err)
	require.Equal(t, "file", cfg.Type)
	require.Equal(t, "json", cfg.Format)

	var opts struct {
		Filename    string `json:"filename"`
		Max_size    int    `json:"max_size"`
		Max_age     int    `json:"max_age"`
		Max_backups int    `json:"max_backups"`
		Compress    bool   `json:"compress"`
	}
	require.NoError(t, json.Unmarshal(cfg.Options, &opts))
	require.Equal(t, "/tmp/audit.log", opts.Filename)
	require.Equal(t, 5, opts.Max_size)
	require.Equal(t, 7, opts.Max_age)
	require.Equal(t, 2, opts.Max_backups)
	require.True(t, opts.Compress)
}

func TestMakeFileTargetFromAudit(t *testing.T) {
	fn := "/tmp/audit.log"
	ms := 6
	ma := 9
	mb := 4
	c := true
	a := &model.ExperimentalAuditSettings{
		FileName:       &fn,
		FileMaxSizeMB:  &ms,
		FileMaxAgeDays: &ma,
		FileMaxBackups: &mb,
		FileCompress:   &c,
	}

	cfg, err := makeFileTargetFromAudit(a, "warn", false)
	require.NoError(t, err)
	require.Equal(t, "file", cfg.Type)
	require.Equal(t, "plain", cfg.Format)

	var opts struct {
		Filename    string `json:"filename"`
		Max_size    int    `json:"max_size"`
		Max_age     int    `json:"max_age"`
		Max_backups int    `json:"max_backups"`
		Compress    bool   `json:"compress"`
	}
	require.NoError(t, json.Unmarshal(cfg.Options, &opts))
	require.Equal(t, fn, opts.Filename)
	require.Equal(t, ms, opts.Max_size)
	require.Equal(t, ma, opts.Max_age)
	require.Equal(t, mb, opts.Max_backups)
	require.True(t, opts.Compress)
}
