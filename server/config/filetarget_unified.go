package config

import (
	"encoding/json"

	mlog "github.com/mattermost/logr/v2"
)

// JSON shape used by the file target (lumberjack-like)
type fileRotationOpts struct {
	Filename   string `json:"filename"`
	MaxSize    int    `json:"max_size"`
	MaxAge     int    `json:"max_age"`
	MaxBackups int    `json:"max_backups"`
	Compress   bool   `json:"compress"`
}

// makeFileTarget creates a generic file target with rotation options.
// Callers decide the level slice and format (json/plain) via the params.
func makeFileTarget(filename string, minLevel string, asJSON bool, sizeMB, ageDays, backups int, compress bool) (mlog.TargetCfg, error) {
	opts := fileRotationOpts{
		Filename:   filename,
		MaxSize:    sizeMB,
		MaxAge:     ageDays,
		MaxBackups: backups,
		Compress:   compress,
	}
	raw, err := json.Marshal(opts)
	if err != nil {
		return mlog.TargetCfg{}, err
	}

	format := "plain"
	if asJSON {
		format = "json"
	}

	// Keep this simple: let the target accept just the min level as a single entry.
	// (If you already have a helper to expand levels, swap this slice for that.)
	levels := []string{minLevel}

	return mlog.TargetCfg{
		Type:         "file",
		Levels:       levels,
		MaxQueueSize: LogMaxQueue,
		Format:       format,
		Options:      raw,
	}, nil
}
