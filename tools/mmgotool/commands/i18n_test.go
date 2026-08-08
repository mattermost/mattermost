// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/cobra"
)

func TestExtractCmdFContributorModePreservesBaseFileKeysWithoutEnterpriseSources(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name          string
		enterpriseDir string
		createDir     bool
	}{
		{
			name:          "nonexistent enterprise dir",
			enterpriseDir: "missing-enterprise",
		},
		{
			name:          "empty enterprise dir",
			enterpriseDir: "empty-enterprise",
			createDir:     true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			root := t.TempDir()
			serverDir := filepath.Join(root, "server")
			modelDir := filepath.Join(root, "model")
			pluginDir := filepath.Join(root, "plugin")
			enterpriseDir := filepath.Join(root, tc.enterpriseDir)

			mustMkdirAll(t, filepath.Join(serverDir, "i18n"))
			mustMkdirAll(t, modelDir)
			mustMkdirAll(t, pluginDir)
			if tc.createDir {
				mustMkdirAll(t, enterpriseDir)
			}

			baseFile := []Translation{
				{Id: "app.pap.delete_policy.app_error", Translation: "preserve enterprise key"},
				{Id: "custom.existing.key", Translation: "preserve existing key"},
			}
			writeJSONFile(t, filepath.Join(serverDir, "i18n", "en.json"), baseFile)

			source := `package main
			func f() {
				T("new.translation.key")
			}`
			mustWriteFile(t, filepath.Join(serverDir, "sample.go"), source)

			cmd := newExtractTestCommand()
			mustSetFlag(t, cmd, "skip-dynamic", "true")
			mustSetFlag(t, cmd, "portal-dir", "")
			mustSetFlag(t, cmd, "enterprise-dir", enterpriseDir)
			mustSetFlag(t, cmd, "server-dir", serverDir)
			mustSetFlag(t, cmd, "model-dir", modelDir)
			mustSetFlag(t, cmd, "plugin-dir", pluginDir)
			mustSetFlag(t, cmd, "contributor", "true")

			if err := extractCmdF(cmd, nil); err != nil {
				t.Fatalf("extractCmdF returned error: %v", err)
			}

			got := readTranslations(t, filepath.Join(serverDir, "i18n", "en.json"))
			gotMap := map[string]any{}
			for _, tr := range got {
				gotMap[tr.Id] = tr.Translation
			}

			if gotMap["app.pap.delete_policy.app_error"] != "preserve enterprise key" {
				t.Fatalf("enterprise key was not preserved, got: %#v", gotMap["app.pap.delete_policy.app_error"])
			}
			if gotMap["custom.existing.key"] != "preserve existing key" {
				t.Fatalf("existing base-file key was not preserved, got: %#v", gotMap["custom.existing.key"])
			}
			if gotMap["new.translation.key"] != "" {
				t.Fatalf("newly extracted key was not added as empty translation, got: %#v", gotMap["new.translation.key"])
			}
		})
	}
}

func newExtractTestCommand() *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().Bool("skip-dynamic", false, "")
	cmd.Flags().String("portal-dir", "", "")
	cmd.Flags().String("enterprise-dir", "", "")
	cmd.Flags().String("server-dir", "", "")
	cmd.Flags().String("model-dir", "", "")
	cmd.Flags().String("plugin-dir", "", "")
	cmd.Flags().Bool("contributor", false, "")
	return cmd
}

func mustSetFlag(t *testing.T, cmd *cobra.Command, name, value string) {
	t.Helper()
	if err := cmd.Flags().Set(name, value); err != nil {
		t.Fatalf("failed setting flag %s: %v", name, err)
	}
}

func mustMkdirAll(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("failed creating dir %s: %v", dir, err)
	}
}

func mustWriteFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("failed writing file %s: %v", path, err)
	}
}

func writeJSONFile(t *testing.T, path string, value any) {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("failed marshaling JSON: %v", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("failed writing json file %s: %v", path, err)
	}
}

func readTranslations(t *testing.T, path string) []Translation {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed reading translations: %v", err)
	}

	var got []Translation
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("failed unmarshaling translations: %v", err)
	}
	return got
}
