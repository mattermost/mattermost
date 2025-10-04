//go:build auditonly

package config

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestMakeFileTarget(t *testing.T) {
	cfg, err := makeFileTarget("/tmp/audit.log", "error", true, 5, 7, 2, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Type != "file" {
		t.Fatalf("expected Type=file, got %q", cfg.Type)
	}
	if cfg.Format != "json" {
		t.Fatalf("expected Format=json, got %q", cfg.Format)
	}

	var opts struct {
		Filename    string `json:"filename"`
		Max_size    int    `json:"max_size"`
		Max_age     int    `json:"max_age"`
		Max_backups int    `json:"max_backups"`
		Compress    bool   `json:"compress"`
	}
	if err := json.Unmarshal(cfg.Options, &opts); err != nil {
		t.Fatalf("failed to unmarshal Options: %v", err)
	}

	if opts.Filename != "/tmp/audit.log" {
		t.Errorf("Filename mismatch: %q", opts.Filename)
	}
	if opts.Max_size != 5 || opts.Max_age != 7 || opts.Max_backups != 2 || !opts.Compress {
		t.Errorf("rotation opts mismatch: %+v", opts)
	}
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
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Type != "file" {
		t.Fatalf("expected Type=file, got %q", cfg.Type)
	}
	if cfg.Format != "plain" {
		t.Fatalf("expected Format=plain, got %q", cfg.Format)
	}

	var opts struct {
		Filename    string `json:"filename"`
		Max_size    int    `json:"max_size"`
		Max_age     int    `json:"max_age"`
		Max_backups int    `json:"max_backups"`
		Compress    bool   `json:"compress"`
	}
	if err := json.Unmarshal(cfg.Options, &opts); err != nil {
		t.Fatalf("failed to unmarshal Options: %v", err)
	}

	if opts.Filename != fn || opts.Max_size != ms || opts.Max_age != ma || opts.Max_backups != mb || !opts.Compress {
		t.Errorf("rotation opts mismatch: %+v", opts)
	}
}
