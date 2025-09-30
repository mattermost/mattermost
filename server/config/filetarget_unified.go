package config

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	logr "github.com/mattermost/logr/v2"
	"github.com/mattermost/mattermost/server/public/model"
)

// makeFileTarget builds a logr file target with rotation options.
func makeFileTarget(filename, level string, asJSON bool, maxSizeMB, maxAgeDays, maxBackups int, compress bool) (logr.TargetCfg, error) {
	if strings.TrimSpace(filename) == "" {
		return logr.TargetCfg{}, fmt.Errorf("filename must not be empty")
	}
	filename = filepath.Clean(filename)

	// Level filter
	lvl := struct {
		Level string `json:"level"`
	}{Level: level}
	lvlJSON, _ := json.Marshal(lvl)

	format := "plain"
	if asJSON {
		format = "json"
	}

	// File target options for logr
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

	return logr.TargetCfg{
		Type:      "file",
		Options:   optsJSON,
		Filters:   []logr.FilterCfg{{Type: "level", Options: lvlJSON}},
		Format:    format,
		QueueSize: 1000,
	}, nil
}

// makeFileTargetFromAudit adapts ExperimentalAuditSettings to makeFileTarget.
func makeFileTargetFromAudit(a *model.ExperimentalAuditSettings, level string, asJSON bool) (logr.TargetCfg, error) {
	return makeFileTarget(
		*a.FileName,
		level,
		asJSON,
		int(*a.FileMaxSizeMB),
		int(*a.FileMaxAgeDays),
		int(*a.FileMaxBackups),
		bool(*a.FileCompress),
	)
}
