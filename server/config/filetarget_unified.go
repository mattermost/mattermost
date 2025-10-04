package config

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// makeFileTarget builds a file target with rotation options using the server mlog wrapper.
func makeFileTarget(
	filename, _ string, // level argument is ignored here; server mlog.TargetCfg has no Level field
	asJSON bool,
	maxSizeMB, maxAgeDays, maxBackups int,
	compress bool,
) (mlog.TargetCfg, error) {
	if strings.TrimSpace(filename) == "" {
		return mlog.TargetCfg{}, fmt.Errorf("filename must not be empty")
	}
	filename = filepath.Clean(filename)

	format := "plain"
	if asJSON {
		format = "json"
	}

	// File target options for mlog
	opts := struct {
		Filename    string `json:"filename"`
		Max_size    int    `json:"max_size"`
		Max_age     int    `json:"max_age"`
		Max_backups int    `json:"max_backups"`
		Compress    bool   `json:"compress"`
	}{
		Filename:    filename,
		Max_size:    maxSizeMB,
		Max_age:     maxAgeDays,
		Max_backups: maxBackups,
		Compress:    compress,
	}
	optsJSON, _ := json.Marshal(opts)

	return mlog.TargetCfg{
		Type:    "file",
		Options: optsJSON, // file rotation options
		Format:  format,   // "plain" or "json"
	}, nil
}

// makeFileTargetFromAudit adapts ExperimentalAuditSettings to makeFileTarget.
func makeFileTargetFromAudit(a *model.ExperimentalAuditSettings, level string, asJSON bool) (mlog.TargetCfg, error) {
	return makeFileTarget(
		*a.FileName,
		level, // ignored by makeFileTarget but kept for signature compatibility
		asJSON,
		int(*a.FileMaxSizeMB),
		int(*a.FileMaxAgeDays),
		int(*a.FileMaxBackups),
		bool(*a.FileCompress),
	)
}
