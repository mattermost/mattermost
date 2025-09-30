package config

import (
	mlog "github.com/mattermost/logr/v2"
	"github.com/mattermost/mattermost/server/public/model"
)

// Unified helper for file targets (regular + audit), with rotation options.
func makeFileTarget(filename string, level string, asJSON bool, maxSizeMB, maxAgeDays, maxBackups int, compress bool) (mlog.TargetCfg, error) {
	format := "plain"
	if asJSON {
		format = "json"
	}
	return mlog.TargetCfg{
		Type:       "file",
		Level:      level,
		Format:     format,
		Async:      true,
		BufferSize: 1000,
		Options: map[string]any{
			"filename":    filename,
			"max_size":    maxSizeMB,
			"max_age":     maxAgeDays,
			"max_backups": maxBackups,
			"compress":    compress,
		},
	}, nil
}

// makeFileTargetFromAudit adapts ExperimentalAuditSettings to makeFileTarget.
func makeFileTargetFromAudit(a *model.ExperimentalAuditSettings, level string, asJSON bool) (mlog.TargetCfg, error) {
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
