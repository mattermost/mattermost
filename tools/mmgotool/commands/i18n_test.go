// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"os"
	"path"
	"path/filepath"
	"sort"
	"testing"
)

func testdataDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.Abs("testdata")
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

// TestExtractSrcStrings verifies that extractSrcStrings collects IDs from all directories.
func TestExtractSrcStrings(t *testing.T) {
	td := testdataDir(t)
	serverDir := path.Join(td, "server")
	enterpriseDir := path.Join(td, "enterprise")
	modelDir := path.Join(td, "model")
	pluginDir := path.Join(td, "plugin")

	got := extractSrcStrings(enterpriseDir, serverDir, modelDir, pluginDir, "")

	expected := []string{
		"server.do_stuff.error",
		"server.create.app_error",
		"ent.license.check.error",
		"ent.feature.app_error",
		"model.validate.app_error",
		"plugin.hook.error",
	}
	for _, id := range expected {
		if !got[id] {
			t.Errorf("expected string %q not found in extracted strings", id)
		}
	}
}

// TestExtractSrcStringsWithOrigin verifies server vs enterprise classification.
func TestExtractSrcStringsWithOrigin(t *testing.T) {
	td := testdataDir(t)
	serverDir := path.Join(td, "server")
	enterpriseDir := path.Join(td, "enterprise")
	modelDir := path.Join(td, "model")
	pluginDir := path.Join(td, "plugin")

	serverStrings, entStrings := extractSrcStringsWithOrigin(enterpriseDir, serverDir, modelDir, pluginDir)

	// Server strings should contain server, model, and plugin IDs
	serverExpected := []string{
		"server.do_stuff.error",
		"server.create.app_error",
		"model.validate.app_error",
		"plugin.hook.error",
	}
	for _, id := range serverExpected {
		if !serverStrings[id] {
			t.Errorf("expected server string %q not found", id)
		}
	}

	// Enterprise strings
	entExpected := []string{
		"ent.license.check.error",
		"ent.feature.app_error",
	}
	for _, id := range entExpected {
		if !entStrings[id] {
			t.Errorf("expected enterprise string %q not found", id)
		}
	}

	// Enterprise strings should NOT be in server map
	for _, id := range entExpected {
		if serverStrings[id] {
			t.Errorf("enterprise string %q should not be in server strings", id)
		}
	}

	// Server strings should NOT be in enterprise map
	for _, id := range serverExpected {
		if entStrings[id] {
			t.Errorf("server string %q should not be in enterprise strings", id)
		}
	}
}

// TestExtractSrcStringsWithOrigin_OverlapResolution verifies that a string present in both
// server and enterprise directories is classified as server-only.
func TestExtractSrcStringsWithOrigin_OverlapResolution(t *testing.T) {
	td := testdataDir(t)
	serverDir := path.Join(td, "overlap", "server")
	enterpriseDir := path.Join(td, "overlap", "enterprise")
	// Use empty dirs for model/plugin — they must exist but can be empty
	emptyDir := path.Join(td, "empty_enterprise")

	serverStrings, entStrings := extractSrcStringsWithOrigin(enterpriseDir, serverDir, emptyDir, emptyDir)

	if !serverStrings["shared.overlap.key"] {
		t.Error("overlapping key should be classified as server")
	}
	if entStrings["shared.overlap.key"] {
		t.Error("overlapping key should NOT be in enterprise strings")
	}
}

// TestExtractSrcStringsWithOrigin_EmptyEnterprise verifies behavior when enterprise dir is empty.
func TestExtractSrcStringsWithOrigin_EmptyEnterprise(t *testing.T) {
	td := testdataDir(t)
	serverDir := path.Join(td, "server")
	emptyDir := path.Join(td, "empty_enterprise")
	modelDir := path.Join(td, "model")
	pluginDir := path.Join(td, "plugin")

	serverStrings, entStrings := extractSrcStringsWithOrigin(emptyDir, serverDir, modelDir, pluginDir)

	if len(entStrings) != 0 {
		t.Errorf("expected no enterprise strings, got %d", len(entStrings))
	}
	if len(serverStrings) == 0 {
		t.Error("expected server strings but got none")
	}
}

// TestWriteTranslationFile verifies writing and reading back translations.
func TestWriteTranslationFile(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := path.Join(tmpDir, "en.json")

	translations := []Translation{
		{Id: "z.last", Translation: "Last"},
		{Id: "a.first", Translation: "First"},
		{Id: "m.middle", Translation: "Middle"},
	}

	err := writeTranslationFile(filePath, translations)
	if err != nil {
		t.Fatalf("writeTranslationFile failed: %v", err)
	}

	// Read back
	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read written file: %v", err)
	}

	var readBack []Translation
	if err := json.Unmarshal(data, &readBack); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// Verify sorted order
	if len(readBack) != 3 {
		t.Fatalf("expected 3 translations, got %d", len(readBack))
	}
	if readBack[0].Id != "a.first" {
		t.Errorf("expected first entry to be a.first, got %s", readBack[0].Id)
	}
	if readBack[1].Id != "m.middle" {
		t.Errorf("expected second entry to be m.middle, got %s", readBack[1].Id)
	}
	if readBack[2].Id != "z.last" {
		t.Errorf("expected third entry to be z.last, got %s", readBack[2].Id)
	}
}

// TestWriteTranslationFile_Empty verifies writing an empty translation list.
func TestWriteTranslationFile_Empty(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := path.Join(tmpDir, "en.json")

	err := writeTranslationFile(filePath, []Translation{})
	if err != nil {
		t.Fatalf("writeTranslationFile failed: %v", err)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read: %v", err)
	}

	var readBack []Translation
	if err := json.Unmarshal(data, &readBack); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(readBack) != 0 {
		t.Errorf("expected 0 translations, got %d", len(readBack))
	}
}

// TestRoundTrip_ExtractWriteRead extracts strings, writes them, reads them back.
func TestRoundTrip_ExtractWriteRead(t *testing.T) {
	td := testdataDir(t)
	serverDir := path.Join(td, "server")
	enterpriseDir := path.Join(td, "enterprise")
	modelDir := path.Join(td, "model")
	pluginDir := path.Join(td, "plugin")

	serverStrings, entStrings := extractSrcStringsWithOrigin(enterpriseDir, serverDir, modelDir, pluginDir)

	tmpDir := t.TempDir()

	// Build server translations
	var serverTranslations []Translation
	for id := range serverStrings {
		serverTranslations = append(serverTranslations, Translation{Id: id, Translation: ""})
	}
	serverFile := path.Join(tmpDir, "en.json")
	if err := writeTranslationFile(serverFile, serverTranslations); err != nil {
		t.Fatalf("failed to write server file: %v", err)
	}

	// Build enterprise translations
	var entTranslations []Translation
	for id := range entStrings {
		entTranslations = append(entTranslations, Translation{Id: id, Translation: ""})
	}
	entFile := path.Join(tmpDir, "en.enterprise.json")
	if err := writeTranslationFile(entFile, entTranslations); err != nil {
		t.Fatalf("failed to write enterprise file: %v", err)
	}

	// Read back and verify no overlap
	sData, _ := os.ReadFile(serverFile)
	var sRead []Translation
	json.Unmarshal(sData, &sRead)

	eData, _ := os.ReadFile(entFile)
	var eRead []Translation
	json.Unmarshal(eData, &eRead)

	serverIDs := map[string]bool{}
	for _, t := range sRead {
		serverIDs[t.Id] = true
	}

	for _, tr := range eRead {
		if serverIDs[tr.Id] {
			t.Errorf("enterprise string %q also found in server file — should not overlap", tr.Id)
		}
	}

	// Verify counts match
	if len(sRead) != len(serverStrings) {
		t.Errorf("server count mismatch: wrote %d, read %d", len(serverStrings), len(sRead))
	}
	if len(eRead) != len(entStrings) {
		t.Errorf("enterprise count mismatch: wrote %d, read %d", len(entStrings), len(eRead))
	}
}

// TestGetEnterpriseBaseFileSrcStrings_NonExistent returns empty for missing file.
func TestGetEnterpriseBaseFileSrcStrings_NonExistent(t *testing.T) {
	tmpDir := t.TempDir()
	os.MkdirAll(path.Join(tmpDir, "i18n"), 0755)

	translations, err := getEnterpriseBaseFileSrcStrings(tmpDir)
	if err != nil {
		t.Fatalf("expected no error for missing file, got: %v", err)
	}
	if len(translations) != 0 {
		t.Errorf("expected empty translations, got %d", len(translations))
	}
}

// TestGetEnterpriseBaseFileSrcStrings_Existing reads an existing enterprise file.
func TestGetEnterpriseBaseFileSrcStrings_Existing(t *testing.T) {
	tmpDir := t.TempDir()
	i18nDir := path.Join(tmpDir, "i18n")
	os.MkdirAll(i18nDir, 0755)

	translations := []Translation{
		{Id: "ent.test.key", Translation: "Test value"},
	}
	data, _ := json.Marshal(translations)
	os.WriteFile(path.Join(i18nDir, "en.enterprise.json"), data, 0644)

	got, err := getEnterpriseBaseFileSrcStrings(tmpDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].Id != "ent.test.key" {
		t.Errorf("unexpected result: %+v", got)
	}
}

// TestWriteTranslationFile_SortOrder verifies output is sorted by ID.
func TestWriteTranslationFile_SortOrder(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := path.Join(tmpDir, "sorted.json")

	input := []Translation{
		{Id: "c.third", Translation: "C"},
		{Id: "a.first", Translation: "A"},
		{Id: "b.second", Translation: "B"},
	}

	if err := writeTranslationFile(filePath, input); err != nil {
		t.Fatal(err)
	}

	data, _ := os.ReadFile(filePath)
	var result []Translation
	json.Unmarshal(data, &result)

	for i := 1; i < len(result); i++ {
		if result[i].Id < result[i-1].Id {
			t.Errorf("output not sorted: %s came after %s", result[i].Id, result[i-1].Id)
		}
	}
}

// TestExtractSplitCmdF_Integration does an end-to-end test of the split extraction flow.
func TestExtractSplitCmdF_Integration(t *testing.T) {
	td := testdataDir(t)
	serverDir := path.Join(td, "server")
	enterpriseDir := path.Join(td, "enterprise")
	modelDir := path.Join(td, "model")
	pluginDir := path.Join(td, "plugin")

	// Create a temp dir that mimics the server dir with i18n/
	tmpDir := t.TempDir()
	i18nDir := path.Join(tmpDir, "i18n")
	os.MkdirAll(i18nDir, 0755)

	// Seed en.json with some existing translations (including one that will move to enterprise)
	existingServer := []Translation{
		{Id: "server.do_stuff.error", Translation: "Existing server translation"},
		{Id: "ent.license.check.error", Translation: "This should migrate to enterprise file"},
		{Id: "stale.removed.key", Translation: "This should be removed"},
	}
	existingData, _ := json.Marshal(existingServer)
	os.WriteFile(path.Join(i18nDir, "en.json"), existingData, 0644)

	// Extract with origin using the testdata dirs but write to tmpDir
	serverStrings, entStrings := extractSrcStringsWithOrigin(enterpriseDir, serverDir, modelDir, pluginDir)
	delete(serverStrings, untranslatedKey)
	delete(entStrings, untranslatedKey)

	// Process server strings against existing en.json
	sourceStrings, err := getBaseFileSrcStrings(tmpDir)
	if err != nil {
		t.Fatal(err)
	}

	serverResultMap := map[string]Translation{}
	serverIdx := map[string]bool{}
	var serverBaseList []string
	for _, tr := range sourceStrings {
		serverIdx[tr.Id] = true
		serverBaseList = append(serverBaseList, tr.Id)
		serverResultMap[tr.Id] = tr
	}

	for id := range serverStrings {
		if _, hasKey := serverIdx[id]; !hasKey {
			serverResultMap[id] = Translation{Id: id, Translation: ""}
		}
	}

	for _, key := range serverBaseList {
		if _, inServer := serverStrings[key]; !inServer {
			if _, inEnt := entStrings[key]; !inEnt {
				delete(serverResultMap, key)
			} else {
				delete(serverResultMap, key)
			}
		}
	}

	var serverResult []Translation
	for _, tr := range serverResultMap {
		serverResult = append(serverResult, tr)
	}

	// Process enterprise strings
	entResultMap := map[string]Translation{}
	// Migrate translations from en.json
	for _, tr := range sourceStrings {
		if _, isEnt := entStrings[tr.Id]; isEnt {
			entResultMap[tr.Id] = tr
		}
	}
	for id := range entStrings {
		if _, hasKey := entResultMap[id]; !hasKey {
			entResultMap[id] = Translation{Id: id, Translation: ""}
		}
	}

	var entResult []Translation
	for _, tr := range entResultMap {
		entResult = append(entResult, tr)
	}

	// Write both files
	if err := writeTranslationFile(path.Join(i18nDir, "en.json"), serverResult); err != nil {
		t.Fatal(err)
	}
	if err := writeTranslationFile(path.Join(i18nDir, "en.enterprise.json"), entResult); err != nil {
		t.Fatal(err)
	}

	// Read back and verify
	sData, _ := os.ReadFile(path.Join(i18nDir, "en.json"))
	var sResult []Translation
	json.Unmarshal(sData, &sResult)

	eData, _ := os.ReadFile(path.Join(i18nDir, "en.enterprise.json"))
	var eResult []Translation
	json.Unmarshal(eData, &eResult)

	// Server file should not contain enterprise keys
	serverIDs := map[string]bool{}
	for _, tr := range sResult {
		serverIDs[tr.Id] = true
	}
	if serverIDs["ent.license.check.error"] {
		t.Error("enterprise key should not be in server file")
	}
	if serverIDs["ent.feature.app_error"] {
		t.Error("enterprise key should not be in server file")
	}
	if serverIDs["stale.removed.key"] {
		t.Error("stale key should have been removed from server file")
	}

	// Enterprise file should contain enterprise keys
	entIDs := map[string]bool{}
	for _, tr := range eResult {
		entIDs[tr.Id] = true
	}
	if !entIDs["ent.license.check.error"] {
		t.Error("enterprise key missing from enterprise file")
	}
	if !entIDs["ent.feature.app_error"] {
		t.Error("enterprise key missing from enterprise file")
	}

	// Verify migrated translation preserved its value
	for _, tr := range eResult {
		if tr.Id == "ent.license.check.error" {
			if tr.Translation != "This should migrate to enterprise file" {
				t.Errorf("migrated translation value not preserved, got: %v", tr.Translation)
			}
		}
	}

	// Server file should have server, model, plugin strings
	expectedServer := []string{"server.do_stuff.error", "server.create.app_error", "model.validate.app_error", "plugin.hook.error"}
	sort.Strings(expectedServer)
	for _, id := range expectedServer {
		if !serverIDs[id] {
			t.Errorf("expected server string %q missing from output", id)
		}
	}

	// Existing translation should be preserved
	for _, tr := range sResult {
		if tr.Id == "server.do_stuff.error" {
			if tr.Translation != "Existing server translation" {
				t.Errorf("existing translation not preserved, got: %v", tr.Translation)
			}
		}
	}
}
