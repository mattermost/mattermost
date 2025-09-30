package config

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
)

type fileOpts struct {
	Filename    string `json:"filename"`
	Max_size    int    `json:"max_size"`
	Max_age     int    `json:"max_age"`
	Max_backups int    `json:"max_backups"`
	Compress    bool   `json:"compress"`
}

type levelOpts struct {
	Level string `json:"level"`
}

func TestMakeFileTarget_JSONAndRotation(t *testing.T) {
	cfg, err := makeFileTarget("x.log", "error", true, 11, 22, 33, true)
	if err != nil {
		t.Fatalf("makeFileTarget error: %v", err)
	}
	if cfg.Type != "file" {
		t.Fatalf("Type = %q, want file", cfg.Type)
	}
	if cfg.Format != "json" {
		t.Fatalf("Format = %q, want json", cfg.Format)
	}
	if cfg.QueueSize != 1000 {
		t.Fatalf("QueueSize = %d, want 1000", cfg.QueueSize)
	}

	var o fileOpts
	if err := json.Unmarshal(cfg.Options, &o); err != nil {
		t.Fatalf("unmarshal options: %v", err)
	}
	if o.Filename != "x.log" || o.Max_size != 11 || o.Max_age != 22 || o.Max_backups != 33 || !o.Compress {
		t.Fatalf("opts = %+v, want filename=x.log max_size=11 max_age=22 max_backups=33 compress=true", o)
	}

	if len(cfg.Filters) != 1 {
		t.Fatalf("len(Filters) = %d, want 1", len(cfg.Filters))
	}
	var lv levelOpts
	if err := json.Unmarshal(cfg.Filters[0].Options, &lv); err != nil {
		t.Fatalf("unmarshal filter: %v", err)
	}
	if lv.Level != "error" {
		t.Fatalf("level = %q, want error", lv.Level)
	}
}

func TestMakeFileTarget_EmptyFilename(t *testing.T) {
	if _, err := makeFileTarget("   ", "info", false, 1, 1, 1, false); err == nil {
		t.Fatalf("expected error for empty filename")
	}
}

func TestMakeFileTargetFromAudit_Adapts(t *testing.T) {
	fn := "audit.log"
	ms := 5
	ma := 6
	mb := 7
	cp := true

	a := &model.ExperimentalAuditSettings{
		FileName:       &fn,
		FileMaxSizeMB:  &ms,
		FileMaxAgeDays: &ma,
		FileMaxBackups: &mb,
		FileCompress:   &cp,
	}

	cfg, err := makeFileTargetFromAudit(a, "error", true)
	if err != nil {
		t.Fatalf("makeFileTargetFromAudit error: %v", err)
	}

	var o fileOpts
	if err := json.Unmarshal(cfg.Options, &o); err != nil {
		t.Fatalf("unmarshal options: %v", err)
	}
	if o.Filename != fn || o.Max_size != ms || o.Max_age != ma || o.Max_backups != mb || !o.Compress {
		t.Fatalf("opts = %+v, want filename=%s max_size=%d max_age=%d max_backups=%d compress=true", o, fn, ms, ma, mb)
	}
}
