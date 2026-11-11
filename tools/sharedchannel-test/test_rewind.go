package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const cursorPluginID = "com.mattermost.sharedchannel-test-cursor"

// runCursorRewindTests verifies that moving a remote's sync cursor back with the
// UpdateSharedChannelCursor plugin API re-sends everything after the new cursor.
// The channel's content, including edits, reactions, acknowledgements, a reply and
// a delete, is written before the channel is shared, so only the rewind can bring
// it to Server B.
//
// The test installs a small plugin (cursorplugin), built for this machine, on
// Server A with plugin uploads enabled, so it is skipped in unmanaged mode.
func (tr *TestRunner) runCursorRewindTests(ctx context.Context) error {
	tr.logger.Info("=== Cursor Rewind Tests ===")

	if !tr.cfg.Manage || tr.mgr == nil {
		tr.logger.Info("Skipping cursor rewind test (requires managed mode to install the test plugin)")
		return nil
	}

	channelA, err := tr.createChannelOnA(ctx, "rewind-test")
	if err != nil {
		tr.fail("rewind/setup", err.Error())
		return err
	}
	users, err := tr.createContentUsers(ctx, "rewinduser", 3, channelA)
	if err != nil {
		tr.fail("rewind/create-users", err.Error())
		return err
	}

	cr := newContentRun(tr, channelA, users)
	if err := cr.makeBase(ctx, 30); err != nil {
		tr.fail("rewind/base", err.Error())
		return err
	}
	first, _, err := tr.clientA.GetPost(ctx, cr.base[0], "")
	if err != nil {
		tr.fail("rewind/base", err.Error())
		return err
	}
	// Server A's clock, so the cursor lands before the content.
	rewindTo := first.CreateAt - 1
	if err := cr.mutate(ctx, 60); err != nil {
		tr.fail("rewind/mutate", err.Error())
		return err
	}
	if err := interruptibleSleep(ctx, time.Second); err != nil {
		tr.fail("rewind/share", err.Error())
		return err
	}

	channelB, err := tr.shareChannelWithB(ctx, "rewind-test", channelA)
	if err != nil {
		tr.fail("rewind/share", err.Error())
		return err
	}
	if err := tr.waitForMembersOnB(ctx, channelB, users); err != nil {
		tr.fail("rewind/user-sync", "users did not sync to Server B after sharing")
		return err
	}

	// Sharing starts the cursor at the share time, so none of the older content may
	// be on Server B yet. Otherwise a pass below would not show the rewind worked.
	// The pause gives any sync started by the share time to finish first.
	if err := interruptibleSleep(ctx, 10*time.Second); err != nil {
		tr.fail("rewind/not-synced-before-rewind", err.Error())
		return err
	}
	readCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	stateB, err := fetchChannelState(readCtx, tr.clientB, channelB)
	cancel()
	if err != nil {
		tr.fail("rewind/not-synced-before-rewind", err.Error())
		return err
	}
	var early []string
	for id := range stateB {
		if label, ok := cr.labels[id]; ok {
			early = append(early, label)
		}
	}
	if len(early) > 0 {
		tr.fail("rewind/not-synced-before-rewind",
			fmt.Sprintf("%d post(s) reached Server B before the rewind, for example %s", len(early), early[0]))
		return nil
	}
	tr.pass("rewind/not-synced-before-rewind")

	uploaded, err := tr.installCursorPlugin(ctx)
	if uploaded {
		defer tr.removeCursorPlugin()
	}
	if err != nil {
		tr.fail("rewind/install-plugin", err.Error())
		return err
	}

	cursorURL := tr.cfg.ServerAURL
	if tr.ha() {
		// A follower hands the sync to the leader, which is the HA path worth covering.
		leader, err := tr.waitForCluster(ctx, tr.nodesA)
		if err != nil {
			tr.fail("rewind/set-cursor", err.Error())
			return err
		}
		follower := otherNodes(tr.nodesA, leader)[0]
		cursorURL = follower.client.URL
		tr.logger.Info("Moving the sync cursor through a follower", mlog.String("node", follower.name))
	}

	tr.logger.Info("Rewinding the sync cursor to before the channel's content...")
	if err := tr.setSyncCursor(ctx, cursorURL, channelA, rewindTo); err != nil {
		tr.fail("rewind/set-cursor", err.Error())
		return err
	}

	tr.checkChannelsMatch(ctx, "rewind/content-synced", channelA, channelB, cr.labels, 5*time.Minute)
	return nil
}

// installCursorPlugin builds cursorplugin for this machine, which runs the
// managed servers, then uploads and enables it on Server A. It reports whether
// the upload happened, so the caller knows to remove the plugin.
func (tr *TestRunner) installCursorPlugin(ctx context.Context) (bool, error) {
	bundle, err := buildCursorPluginBundle(ctx)
	if err != nil {
		return false, err
	}
	if _, _, err := tr.clientA.UploadPluginForced(ctx, bytes.NewReader(bundle)); err != nil {
		return false, fmt.Errorf("upload plugin (PluginSettings.EnableUploads must be true on Server A): %w", err)
	}
	if tr.ha() {
		// Peers install the upload from the file store after a cluster message, and a
		// node rejects enabling a plugin it has not installed yet.
		if err := tr.waitForCursorPlugin(ctx, false); err != nil {
			return true, fmt.Errorf("install plugin: %w", err)
		}
	}
	if _, err := tr.clientA.EnablePlugin(ctx, cursorPluginID); err != nil {
		return true, fmt.Errorf("enable plugin: %w", err)
	}
	if tr.ha() {
		if err := tr.waitForCursorPlugin(ctx, true); err != nil {
			return true, fmt.Errorf("start plugin: %w", err)
		}
	}
	return true, nil
}

// waitForCursorPlugin waits until every Server A node has the cursor plugin
// installed, or running when running is true.
func (tr *TestRunner) waitForCursorPlugin(ctx context.Context, running bool) error {
	const timeout = 60 * time.Second
	// The client sets no HTTP timeout, so a stalled node would block past waitFor's deadline.
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var nodes int
	err := tr.waitFor(ctx, timeout, func() bool {
		statuses, _, err := tr.clientA.GetPluginStatuses(ctx)
		if err != nil {
			return false
		}
		nodes = 0
		for _, s := range statuses {
			if s.PluginId == cursorPluginID && (!running || s.State == model.PluginStateRunning) {
				nodes++
			}
		}
		return nodes == len(tr.nodesA)
	})
	if err != nil {
		return fmt.Errorf("plugin on %d of %d Server A nodes: %w", nodes, len(tr.nodesA), err)
	}
	return nil
}

// removeCursorPlugin disables and removes the cursor plugin, even when the run
// was cancelled, so the uploaded bundle does not stay in ServerDir's file store.
// Enabling and disabling the plugin leaves a disabled entry for it in the plugin
// states of ServerDir's config file.
func (tr *TestRunner) removeCursorPlugin() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if _, err := tr.clientA.DisablePlugin(ctx, cursorPluginID); err != nil {
		tr.logger.Warn("Failed to disable cursor plugin", mlog.Err(err))
	}
	if _, err := tr.clientA.RemovePlugin(ctx, cursorPluginID); err != nil {
		tr.logger.Warn("Failed to remove cursor plugin", mlog.Err(err))
	}
}

// setSyncCursor moves the cursor of the test remote for channelA to updateAt and
// starts a sync, through the cursor plugin on the server at serverURL.
func (tr *TestRunner) setSyncCursor(ctx context.Context, serverURL, channelA string, updateAt int64) error {
	body, err := json.Marshal(map[string]any{"channel_id": channelA, "remote_id": tr.remoteID, "update_at": updateAt})
	if err != nil {
		return err
	}
	url := strings.TrimRight(serverURL, "/") + "/plugins/" + cursorPluginID + "/cursor"

	// The plugin can take a moment to start after it is enabled, so retry while its
	// route is missing. Errors from the plugin itself don't clear on retry.
	client := &http.Client{Timeout: 30 * time.Second}
	var lastErr error
	for range 15 {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+tr.clientA.AuthToken)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Requested-With", "XMLHttpRequest")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("set cursor: %w", err)
		} else {
			msg, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
			resp.Body.Close()
			if resp.StatusCode == http.StatusNoContent {
				return nil
			}
			lastErr = fmt.Errorf("set cursor: status %d: %s", resp.StatusCode, strings.TrimSpace(string(msg)))
			if resp.StatusCode != http.StatusNotFound {
				return lastErr
			}
		}
		if err := interruptibleSleep(ctx, 2*time.Second); err != nil {
			return err
		}
	}
	return lastErr
}

// buildCursorPluginBundle compiles cursorplugin for this machine and returns a
// plugin bundle (.tar.gz). It runs from the tool's directory, which is the
// working directory of "go run .".
func buildCursorPluginBundle(ctx context.Context) ([]byte, error) {
	goos, goarch := runtime.GOOS, runtime.GOARCH
	platform := goos + "-" + goarch
	if _, err := os.Stat("cursorplugin"); err != nil {
		return nil, fmt.Errorf("cursorplugin source not found; run the tool from tools/sharedchannel-test: %w", err)
	}

	tmp, err := os.MkdirTemp("", "sharedchannel-test-plugin-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmp)

	executable := "server/dist/plugin-" + platform
	binPath := filepath.Join(tmp, "plugin")
	cmd := exec.CommandContext(ctx, "go", "build", "-o", binPath, "./cursorplugin")
	cmd.Env = append(os.Environ(), "GOOS="+goos, "GOARCH="+goarch, "CGO_ENABLED=0")
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("build cursor plugin: %w\n%s", err, out)
	}
	bin, err := os.ReadFile(binPath)
	if err != nil {
		return nil, err
	}

	manifest, err := json.Marshal(map[string]any{
		"id":      cursorPluginID,
		"name":    "Shared channel test cursor",
		"version": "0.1.0",
		"server":  map[string]any{"executables": map[string]string{platform: executable}},
	})
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, f := range []struct {
		name string
		mode int64
		data []byte
	}{
		{cursorPluginID + "/plugin.json", 0o644, manifest},
		{cursorPluginID + "/" + executable, 0o755, bin},
	} {
		hdr := &tar.Header{Typeflag: tar.TypeReg, Name: f.name, Mode: f.mode, Size: int64(len(f.data)), ModTime: time.Now()}
		if err := tw.WriteHeader(hdr); err != nil {
			return nil, err
		}
		if _, err := tw.Write(f.data); err != nil {
			return nil, err
		}
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
