// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
//
// gen-bulk-insert-test-data.go generates a Mattermost bulk-import zip,
// imports it via mmctl, waits for the job to complete, and validates the
// results. Designed to verify that bulk INSERT chunking (MM-68076) works
// correctly by exceeding PostgreSQL's 65,535 query parameter limit.
//
// The script is safe to run multiple times — each run creates unique users
// and a unique channel (the team is reused).
//
// Usage:
//
//	go run scripts/gen-bulk-insert-test-data.go [flags]
//
// Flags:
//
//	-users N       Number of users to generate (default 10000)
//	-replies N     Number of replies to one root post (default 10000)
//	-team NAME     Team name to import into, created if needed (default "bulk-test-team")
//	-mmctl PATH    Path to mmctl binary (default "../../server/bin/mmctl")
//	-timeout DUR   Max time to wait for import job (default 10m)
//
// Overflow thresholds exercised with defaults:
//
//	Channel members:     15 cols → chunks at  3,333 rows  (10,000 generated)
//	Team members:         8 cols → chunks at  6,250 rows  (10,000 generated)
//	Posts (replies):     18 cols → chunks at  2,777 rows  (10,000 generated)
//	Thread memberships:   6 cols → chunks at  8,333 rows  (10,000 generated)
//
// Prerequisites:
//
//   - Mattermost server running with local mode enabled
//   - mmctl binary available at the specified path
//   - MaxUsersPerTeam setting high enough for the number of users
package main

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var mmctlBin string

func main() {
	numUsers := flag.Int("users", 10000, "number of users (team + channel members)")
	numReplies := flag.Int("replies", 10000, "number of replies to one root post")
	teamFlag := flag.String("team", "bulk-test-team", "team name to import into (created if it doesn't exist)")
	mmctlPath := flag.String("mmctl", "../../server/bin/mmctl", "path to mmctl binary")
	jobTimeout := flag.Duration("timeout", 10*time.Minute, "max time to wait for import job to complete")
	flag.Parse()

	mmctlBin = *mmctlPath
	replyCount := min(*numReplies, *numUsers)

	runID := randomHex(4)
	teamName := *teamFlag
	channelName := fmt.Sprintf("bulk-test-%s", runID)

	// Step 1: Generate zip.
	zipPath := filepath.Join(os.TempDir(), fmt.Sprintf("bulk-insert-test-%s.zip", runID))
	generateZip(zipPath, runID, teamName, channelName, *numUsers, replyCount)

	// Step 2: Import.
	logf("Importing %s ...", zipPath)
	out := mmctl("import", "process", "--bypass-upload", zipPath)
	logf("  %s", strings.TrimSpace(string(out)))

	// Step 3: Wait for job.
	logf("Waiting for import job to complete (timeout %s) ...", *jobTimeout)
	job := waitForJob(zipPath, *jobTimeout)
	if job == nil {
		fatalf("timed out waiting for import job to complete")
	}
	jobStatus, _ := job["status"].(string)
	if jobStatus != "success" {
		logf("  Import job status: %s", jobStatus)
		if data, ok := job["data"].(map[string]any); ok {
			if errMsg, ok := data["error"].(string); ok {
				logf("  Error: %s", errMsg)
			}
			if line, ok := data["line_number"].(string); ok {
				logf("  Line:  %s", line)
			}
		}
		fatalf("import job did not succeed")
	}
	logf("  Import job: success")

	// Step 4: Validate.
	logf("\nValidating row counts ...")
	passed, failed := validate(runID, teamName, channelName, *numUsers, replyCount)

	logf("\nResults: %d passed, %d failed", passed, failed)
	if failed > 0 {
		os.Exit(1)
	}
}

func generateZip(zipPath, runID, teamName, channelName string, numUsers, replyCount int) {
	f, err := os.Create(zipPath)
	if err != nil {
		fatalf("creating file: %v", err)
	}
	defer f.Close()

	zw := zip.NewWriter(f)

	jw, err := zw.Create("import.jsonl")
	if err != nil {
		fatalf("creating zip entry: %v", err)
	}

	enc := json.NewEncoder(jw)
	enc.SetEscapeHTML(false)

	baseTime := time.Now().UnixMilli()

	logf("Run ID: %s", runID)

	must(enc.Encode(map[string]any{"type": "version", "version": 1}))

	must(enc.Encode(map[string]any{
		"type": "team",
		"team": map[string]any{
			"name":              teamName,
			"display_name":      "Bulk Insert Test Team",
			"type":              "O",
			"allow_open_invite": true,
		},
	}))

	must(enc.Encode(map[string]any{
		"type": "channel",
		"channel": map[string]any{
			"team":         teamName,
			"name":         channelName,
			"display_name": fmt.Sprintf("Bulk Insert Test Channel %s", runID),
			"type":         "O",
		},
	}))

	logf("Generating %d users ...", numUsers)
	usernames := make([]string, numUsers)
	for i := range numUsers {
		username := fmt.Sprintf("bulk%s%05d", runID, i)
		usernames[i] = username
		must(enc.Encode(map[string]any{
			"type": "user",
			"user": map[string]any{
				"username": username,
				"email":    fmt.Sprintf("%s@bulk-test.local", username),
				"password": "BulkTest@12345",
				"teams": []map[string]any{{
					"name":  teamName,
					"roles": "team_user",
					"channels": []map[string]any{{
						"name":  channelName,
						"roles": "channel_user",
					}},
				}},
			},
		}))
	}

	logf("Generating 1 root post with %d replies ...", replyCount)
	replies := make([]map[string]any, replyCount)
	for i := range replyCount {
		replies[i] = map[string]any{
			"user":      usernames[i],
			"message":   fmt.Sprintf("Reply %d from %s", i, usernames[i]),
			"create_at": baseTime + int64(i+1)*1000,
		}
	}

	must(enc.Encode(map[string]any{
		"type": "post",
		"post": map[string]any{
			"team":      teamName,
			"channel":   channelName,
			"user":      usernames[0],
			"message":   "Root post for bulk insert overflow test",
			"create_at": baseTime,
			"replies":   replies,
		},
	}))

	must(zw.Close())

	stat, _ := f.Stat()
	logf("Wrote %s (%.1f MB)", zipPath, float64(stat.Size())/(1024*1024))
	logf("\nOverflow thresholds exercised:")
	logf("  Team members:        %d (threshold: 6,250)", numUsers)
	logf("  Channel members:     %d (threshold: 3,333)", numUsers)
	logf("  Posts (replies):      %d (threshold: 2,777)", replyCount)
	logf("  Thread memberships:   %d (threshold: 8,333)", replyCount)
	logf("")
}

func waitForJob(zipPath string, timeout time.Duration) map[string]any {
	deadline := time.Now().Add(timeout)
	baseName := filepath.Base(zipPath)
	checks := 0
	lastLog := time.Now()

	for time.Now().Before(deadline) {
		checks++
		jobs := getImportJobs()
		for _, job := range jobs {
			data, _ := job["data"].(map[string]any)
			importFile, _ := data["import_file"].(string)
			if filepath.Base(importFile) != baseName {
				continue
			}
			status, _ := job["status"].(string)
			switch status {
			case "success", "error":
				return job
			}
		}
		if time.Since(lastLog) >= 15*time.Second {
			remaining := time.Until(deadline).Truncate(time.Second)
			logf("  Still waiting ... (checks=%d, %s remaining until timeout)", checks, remaining)
			lastLog = time.Now()
		}
		time.Sleep(5 * time.Second)
	}
	return nil
}

func getImportJobs() []map[string]any {
	raw := mmctl("import", "job", "list", "--json")
	var jobs []map[string]any
	if err := parseMMCtlJSON(raw, &jobs); err != nil {
		return nil
	}
	return jobs
}

func validate(runID, teamName, channelName string, numUsers, replyCount int) (passed, failed int) {
	check := func(name string, expected, actual int) {
		status := "PASS"
		if expected != actual {
			status = "FAIL"
			failed++
		} else {
			passed++
		}
		logf("  [%s] %-25s expected=%-6d actual=%d", status, name, expected, actual)
	}

	// Team members: count users in the team matching the run prefix.
	usersRaw := mmctl("user", "list", "--team", teamName, "--all", "--json")
	var users []map[string]any
	if err := parseMMCtlJSON(usersRaw, &users); err != nil {
		fatalf("parsing user list: %v", err)
	}
	prefix := fmt.Sprintf("bulk%s", runID)
	teamMemberCount := 0
	for _, u := range users {
		username, _ := u["username"].(string)
		if strings.HasPrefix(username, prefix) {
			teamMemberCount++
		}
	}
	check("Team members", numUsers, teamMemberCount)

	// Channel post count from channel list JSON (total_msg_count).
	channelsRaw := mmctl("channel", "list", teamName, "--json")
	var channels []map[string]any
	if err := parseMMCtlJSON(channelsRaw, &channels); err != nil {
		fatalf("parsing channel list: %v", err)
	}
	expectedPosts := replyCount + 1 // replies + root
	channelFound := false
	for _, ch := range channels {
		name, _ := ch["name"].(string)
		if name == channelName {
			channelFound = true
			totalMsgCount := int(ch["total_msg_count"].(float64))
			check("Posts (total_msg_count)", expectedPosts, totalMsgCount)
			break
		}
	}
	if !channelFound {
		logf("  [FAIL] Channel %s not found", channelName)
		failed++
	}

	return passed, failed
}

func mmctl(args ...string) []byte {
	cmd := exec.Command(mmctlBin, append([]string{"--local"}, args...)...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		fatalf("mmctl %s: %v\n%s", strings.Join(args, " "), err, stderr.String())
	}
	return stdout.Bytes()
}

// parseMMCtlJSON handles mmctl --json output which may have a trailing
// "There are N ... on local instance" line after the JSON array.
func parseMMCtlJSON(raw []byte, dst any) error {
	end := bytes.LastIndex(raw, []byte("]"))
	if end == -1 {
		return fmt.Errorf("no JSON array found in output: %s", string(raw))
	}
	return json.Unmarshal(raw[:end+1], dst)
}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		fatalf("generating random bytes: %v", err)
	}
	return hex.EncodeToString(b)
}

func must(err error) {
	if err != nil {
		fatalf("%v", err)
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "FATAL: "+format+"\n", args...)
	os.Exit(1)
}

func logf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}
