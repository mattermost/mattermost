// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build integration

package pluginapi_integration_test

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
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mattermost/mattermost/server/public/model"
)

const testPluginID = "com.example.kvprefix-test"

const testPluginMainGo = `package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

type Plugin struct {
	plugin.MattermostPlugin
	client *pluginapi.Client
}

func (p *Plugin) OnActivate() error {
	p.client = pluginapi.NewClient(p.API, p.Driver)
	for i := 0; i < 5; i++ {
		if appErr := p.API.KVSet(fmt.Sprintf("alpha_%d", i), []byte("v")); appErr != nil {
			return fmt.Errorf("failed to set alpha_%d: %s", i, appErr.Error())
		}
		if appErr := p.API.KVSet(fmt.Sprintf("beta_%d", i), []byte("v")); appErr != nil {
			return fmt.Errorf("failed to set beta_%d: %s", i, appErr.Error())
		}
	}
	return nil
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	prefix := r.URL.Query().Get("prefix")
	var opts []pluginapi.ListKeysOption
	if prefix != "" {
		opts = append(opts, pluginapi.WithPrefix(prefix))
	}
	keys, err := p.client.KV.ListKeys(0, 100, opts...)
	resp := map[string]any{"keys": keys}
	if err != nil {
		resp["error"] = err.Error()
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func main() { plugin.ClientMain(&Plugin{}) }
`

const testPluginJSON = `{
  "id": "com.example.kvprefix-test",
  "name": "KV Prefix Integration Test",
  "version": "0.1.0",
  "min_server_version": "5.6.0",
  "server": {
    "executable": "plugin"
  }
}`

// listResponse is the JSON shape returned by the test plugin's /list endpoint.
type listResponse struct {
	Keys  []string `json:"keys"`
	Error string   `json:"error,omitempty"`
}

// buildTestPlugin compiles the test plugin for linux/amd64 and packages it
// as a tar.gz suitable for the Mattermost plugin upload API.
func buildTestPlugin(t *testing.T) []byte {
	t.Helper()

	tmpDir := t.TempDir()

	// Write plugin source.
	require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte(testPluginMainGo), 0600))

	// Find server/public/ directory (our build context for go build).
	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	// thisFile = server/integration/pluginapi/kv_integration_test.go
	serverPublicDir := filepath.Join(filepath.Dir(thisFile), "..", "..", "public")
	serverPublicDir, err := filepath.Abs(serverPublicDir)
	require.NoError(t, err)

	// Cross-compile for linux/amd64.
	pluginBinary := filepath.Join(tmpDir, "plugin")
	cmd := exec.Command("go", "build", "-o", pluginBinary, filepath.Join(tmpDir, "main.go"))
	cmd.Dir = serverPublicDir
	cmd.Env = append(os.Environ(), "GOOS=linux", "GOARCH=amd64", "CGO_ENABLED=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Logf("Plugin compilation output:\n%s", out)
	}
	require.NoError(t, err, "failed to compile test plugin")

	pluginBinaryData, err := os.ReadFile(pluginBinary)
	require.NoError(t, err)

	// Package as tar.gz with the structure Mattermost expects.
	// The manifest's server.executable = "plugin", so the binary goes at "plugin"
	// relative to the plugin root directory.
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gw)

	// plugin.json
	manifestData := []byte(testPluginJSON)
	require.NoError(t, tw.WriteHeader(&tar.Header{
		Name: "plugin.json",
		Mode: 0644,
		Size: int64(len(manifestData)),
	}))
	_, err = tw.Write(manifestData)
	require.NoError(t, err)

	// plugin (the server binary, matching manifest's server.executable)
	require.NoError(t, tw.WriteHeader(&tar.Header{
		Name: "plugin",
		Mode: 0755,
		Size: int64(len(pluginBinaryData)),
	}))
	_, err = tw.Write(pluginBinaryData)
	require.NoError(t, err)

	require.NoError(t, tw.Close())
	require.NoError(t, gw.Close())

	return buf.Bytes()
}

// buildServerImage compiles the Mattermost server from the current branch for
// linux/amd64 and builds a Docker image containing it.
func buildServerImage(t *testing.T, ctx context.Context) string {
	t.Helper()

	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok)
	serverDir := filepath.Join(filepath.Dir(thisFile), "..", "..")
	serverDir, err := filepath.Abs(serverDir)
	require.NoError(t, err)

	tmpDir := t.TempDir()

	// Cross-compile server binary.
	t.Log("Compiling Mattermost server for linux/amd64 (this may take a few minutes)...")
	serverBin := filepath.Join(tmpDir, "mattermost")
	cmd := exec.Command("go", "build", "-o", serverBin, "./cmd/mattermost")
	cmd.Dir = serverDir
	cmd.Env = append(os.Environ(), "GOOS=linux", "GOARCH=amd64", "CGO_ENABLED=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Logf("Server compilation output:\n%s", out)
	}
	require.NoError(t, err, "failed to compile mattermost server")

	// Copy i18n and templates directories (required by the server at startup).
	for _, dir := range []string{"i18n", "templates"} {
		cpCmd := exec.Command("cp", "-r", filepath.Join(serverDir, dir), filepath.Join(tmpDir, dir))
		out, err = cpCmd.CombinedOutput()
		if err != nil {
			t.Logf("Copy %s output:\n%s", dir, out)
		}
		require.NoError(t, err, "failed to copy %s directory", dir)
	}

	// Write Dockerfile.
	dockerfile := `FROM ubuntu:noble
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd -g 2000 mattermost && useradd -u 2000 -g 2000 -d /mattermost mattermost
COPY mattermost /mattermost/bin/mattermost
COPY i18n /mattermost/i18n
COPY templates /mattermost/templates
RUN mkdir -p /mattermost/data /mattermost/logs /mattermost/config /mattermost/plugins /mattermost/client/plugins \
  && chown -R mattermost:mattermost /mattermost
USER mattermost
EXPOSE 8065
WORKDIR /mattermost
CMD ["/mattermost/bin/mattermost"]
`
	require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "Dockerfile"), []byte(dockerfile), 0644))

	// Build Docker image.
	imageTag := "mattermost-integration-test:latest"
	t.Log("Building Docker image...")
	buildCmd := exec.CommandContext(ctx, "docker", "build", "-t", imageTag, tmpDir)
	out, err = buildCmd.CombinedOutput()
	if err != nil {
		t.Logf("Docker build output:\n%s", out)
	}
	require.NoError(t, err, "failed to build docker image")

	return imageTag
}

// startMattermost starts a PostgreSQL container and a Mattermost container,
// waits for Mattermost to become healthy, and returns the base URL.
func startMattermost(t *testing.T, ctx context.Context, image string) (mmURL string, cleanup func()) {
	t.Helper()

	// Start PostgreSQL.
	pgReq := testcontainers.ContainerRequest{
		Image:        "postgres:15",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_USER":     "mmuser",
			"POSTGRES_PASSWORD": "mostest",
			"POSTGRES_DB":       "mattermost_test",
		},
		WaitingFor: wait.ForListeningPort("5432/tcp").WithStartupTimeout(60 * time.Second),
	}
	pgContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: pgReq,
		Started:          true,
	})
	require.NoError(t, err)

	// Get PostgreSQL network address (accessible from other containers in the same network).
	pgHost, err := pgContainer.Host(ctx)
	require.NoError(t, err)
	pgPort, err := pgContainer.MappedPort(ctx, "5432")
	require.NoError(t, err)

	// For container-to-container communication, we need the container's internal IP.
	pgInternalIP, err := pgContainer.ContainerIP(ctx)
	require.NoError(t, err)

	dsn := fmt.Sprintf("postgres://mmuser:mostest@%s:5432/mattermost_test?sslmode=disable", pgInternalIP)
	_ = pgHost // used only for diagnostics
	_ = pgPort // used only for diagnostics

	// Start Mattermost.
	mmReq := testcontainers.ContainerRequest{
		Image:        image,
		ExposedPorts: []string{"8065/tcp"},
		Env: map[string]string{
			"MM_SQLSETTINGS_DRIVERNAME":          "postgres",
			"MM_SQLSETTINGS_DATASOURCE":          dsn,
			"MM_PLUGINSETTINGS_ENABLE":           "true",
			"MM_PLUGINSETTINGS_ENABLEUPLOADS":    "true",
			"MM_SERVICESETTINGS_SITEURL":         "http://localhost:8065",
			"MM_SERVICESETTINGS_ENABLELOCALMODE": "false",
			"MM_TEAMSETTINGS_ENABLEOPENSERVER":   "true",
		},
		WaitingFor: wait.ForHTTP("/api/v4/system/ping").
			WithPort("8065/tcp").
			WithStartupTimeout(120 * time.Second),
	}
	mmContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: mmReq,
		Started:          true,
	})
	require.NoError(t, err)

	mmHost, err := mmContainer.Host(ctx)
	require.NoError(t, err)
	mmPort, err := mmContainer.MappedPort(ctx, "8065")
	require.NoError(t, err)

	baseURL := fmt.Sprintf("http://%s:%s", mmHost, mmPort.Port())

	// Wait a bit extra for server readiness after the health check passes.
	waitForReady(t, baseURL, 60*time.Second)

	cleanup = func() {
		_ = mmContainer.Terminate(ctx)
		_ = pgContainer.Terminate(ctx)
	}

	return baseURL, cleanup
}

// waitForReady polls the system ping endpoint until it responds OK.
func waitForReady(t *testing.T, baseURL string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(baseURL + "/api/v4/system/ping")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(2 * time.Second)
	}
	t.Fatalf("Mattermost at %s did not become ready within %s", baseURL, timeout)
}

// setupAdminAndPlugin creates a system admin user, uploads and enables the test
// plugin, and waits for plugin activation (including OnActivate KV writes).
func setupAdminAndPlugin(t *testing.T, mmURL string, pluginTarGz []byte) {
	t.Helper()

	ctx := context.Background()
	client := model.NewAPIv4Client(mmURL)

	// Create the first user — automatically becomes system admin.
	adminUser := &model.User{
		Email:    "admin@example.com",
		Username: "admin",
		Password: "Admin1234!",
	}
	_, _, err := client.CreateUser(ctx, adminUser)
	require.NoError(t, err, "failed to create admin user")

	// Log in.
	_, _, err = client.Login(ctx, "admin", "Admin1234!")
	require.NoError(t, err, "failed to login as admin")

	// Upload plugin.
	manifest, _, err := client.UploadPluginForced(ctx, bytes.NewReader(pluginTarGz))
	require.NoError(t, err, "failed to upload plugin")
	t.Logf("Uploaded plugin: %s (version %s)", manifest.Id, manifest.Version)

	// Enable plugin.
	_, err = client.EnablePlugin(ctx, testPluginID)
	require.NoError(t, err, "failed to enable plugin")

	// Poll until the plugin is running and its HTTP endpoint responds.
	pluginEndpoint := mmURL + "/plugins/" + testPluginID + "/list"
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		resp, httpErr := http.Get(pluginEndpoint)
		if httpErr == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(2 * time.Second)
	}
	t.Fatal("Plugin endpoint did not become available within 30s")
}

// httpGetPluginList calls the test plugin's /list endpoint and decodes the response.
func httpGetPluginList(t *testing.T, url string) listResponse {
	t.Helper()
	resp, err := http.Get(url)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "plugin endpoint returned non-200: %s", string(body))

	var result listResponse
	require.NoError(t, json.Unmarshal(body, &result))
	return result
}

func TestKVListWithOptions_NewServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	pluginBundle := buildTestPlugin(t)
	image := buildServerImage(t, ctx)

	mmURL, cleanup := startMattermost(t, ctx, image)
	defer cleanup()

	setupAdminAndPlugin(t, mmURL, pluginBundle)

	pluginBase := mmURL + "/plugins/" + testPluginID

	// Test prefix filtering: alpha_
	resp := httpGetPluginList(t, pluginBase+"/list?prefix=alpha_")
	assert.Empty(t, resp.Error, "unexpected error from plugin")
	assert.ElementsMatch(t, []string{"alpha_0", "alpha_1", "alpha_2", "alpha_3", "alpha_4"}, resp.Keys)

	// Test prefix filtering: beta_
	resp = httpGetPluginList(t, pluginBase+"/list?prefix=beta_")
	assert.Empty(t, resp.Error, "unexpected error from plugin")
	assert.ElementsMatch(t, []string{"beta_0", "beta_1", "beta_2", "beta_3", "beta_4"}, resp.Keys)

	// Test prefix filtering: gamma_ (no matches)
	resp = httpGetPluginList(t, pluginBase+"/list?prefix=gamma_")
	assert.Empty(t, resp.Error, "unexpected error from plugin")
	assert.Empty(t, resp.Keys)

	// No prefix returns all 10 keys
	resp = httpGetPluginList(t, pluginBase+"/list")
	assert.Empty(t, resp.Error, "unexpected error from plugin")
	assert.Len(t, resp.Keys, 10)
}

func TestKVListWithOptions_OldServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	ctx := context.Background()
	pluginBundle := buildTestPlugin(t)

	mmURL, cleanup := startMattermost(t, ctx, "mattermost/mattermost-team-edition:11.1")
	defer cleanup()

	setupAdminAndPlugin(t, mmURL, pluginBundle)

	pluginBase := mmURL + "/plugins/" + testPluginID

	// This asserts fallback works
	// On an old server without KVListWithOptions, the pluginapi should detect the
	// "not implemented" error and fall back to KVList + client-side prefix filtering.
	resp := httpGetPluginList(t, pluginBase+"/list?prefix=alpha_")
	assert.Empty(t, resp.Error, "unexpected error from plugin")
	assert.ElementsMatch(t, []string{"alpha_0", "alpha_1", "alpha_2", "alpha_3", "alpha_4"}, resp.Keys)

	resp = httpGetPluginList(t, pluginBase+"/list?prefix=beta_")
	assert.Empty(t, resp.Error, "unexpected error from plugin")
	assert.ElementsMatch(t, []string{"beta_0", "beta_1", "beta_2", "beta_3", "beta_4"}, resp.Keys)

	// No prefix should still work (uses KVList which exists on the old server)
	resp = httpGetPluginList(t, pluginBase+"/list")
	assert.Empty(t, resp.Error, "unexpected error from plugin")
	assert.Len(t, resp.Keys, 10)
}
