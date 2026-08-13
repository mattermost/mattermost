// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

const (
	defaultPluginDir = "/mattermost/prepackaged_plugins"
	defaultPluginURL = "https://pr-builds.mattermost.com/mattermost-plugin-message-based-encryption/latest/message-based-encryption.tar.gz"
)

type artifact struct {
	url      string
	filename string
	tempPath string
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("no Mattermost command supplied")
	}

	pluginDir := envOrDefault("MBE_PLUGIN_DIR", defaultPluginDir)
	pluginURL := envOrDefault("MBE_PLUGIN_URL", defaultPluginURL)
	artifacts := []artifact{
		{url: pluginURL, filename: "message-based-encryption.tar.gz"},
		{url: pluginURL + ".sig", filename: "message-based-encryption.tar.gz.sig"},
	}

	if err := os.MkdirAll(pluginDir, 0o755); err != nil {
		log.Fatalf("create plugin directory: %v", err)
	}

	client := &http.Client{Timeout: 2 * time.Minute}
	for i := range artifacts {
		tempPath, err := download(client, pluginDir, artifacts[i].url)
		if err != nil {
			cleanup(artifacts)
			log.Fatalf("download %s: %v", artifacts[i].filename, err)
		}
		artifacts[i].tempPath = tempPath
	}

	for _, item := range artifacts {
		destination := filepath.Join(pluginDir, item.filename)
		if err := os.Rename(item.tempPath, destination); err != nil {
			cleanup(artifacts)
			log.Fatalf("install %s: %v", item.filename, err)
		}
	}

	log.Printf("installed current signed MBE demo bundle from %s", pluginURL)
	commandPath, err := exec.LookPath(os.Args[1])
	if err != nil {
		log.Fatalf("resolve Mattermost command: %v", err)
	}
	if err := syscall.Exec(commandPath, os.Args[1:], os.Environ()); err != nil {
		log.Fatalf("start Mattermost: %v", err)
	}
}

func download(client *http.Client, dir, url string) (string, error) {
	response, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected HTTP status %s", response.Status)
	}

	tempFile, err := os.CreateTemp(dir, ".mbe-download-*")
	if err != nil {
		return "", err
	}
	tempPath := tempFile.Name()
	keep := false
	defer func() {
		tempFile.Close()
		if !keep {
			os.Remove(tempPath)
		}
	}()

	if _, err := io.Copy(tempFile, response.Body); err != nil {
		return "", err
	}
	if err := tempFile.Sync(); err != nil {
		return "", err
	}
	if err := tempFile.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(tempPath, 0o644); err != nil {
		return "", err
	}

	keep = true
	return tempPath, nil
}

func cleanup(artifacts []artifact) {
	for _, item := range artifacts {
		if item.tempPath != "" {
			_ = os.Remove(item.tempPath)
		}
	}
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
