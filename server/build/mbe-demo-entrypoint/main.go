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
	defaultPluginDir        = "/mattermost/prepackaged_plugins"
	defaultPluginURL        = "https://pr-builds.mattermost.com/mattermost-plugin-message-based-encryption/latest/message-based-encryption.tar.gz"
	defaultMattermostBinary = "/mattermost/bin/mattermost"
)

type artifact struct {
	url      string
	filename string
	tempPath string
}

func main() {
	commandArgs, resolveErr := resolveCommandArgs(os.Args)
	if resolveErr != nil {
		log.Fatal(resolveErr)
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
	commandPath, lookupErr := exec.LookPath(commandArgs[0])
	if lookupErr != nil {
		log.Fatalf("resolve Mattermost command: %v", lookupErr)
	}
	if execErr := syscall.Exec(commandPath, commandArgs, os.Environ()); execErr != nil {
		log.Fatalf("start Mattermost: %v", execErr)
	}
}

func resolveCommandArgs(args []string) ([]string, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("no Mattermost command supplied")
	}

	// Mattermost Operator replaces the image ENTRYPOINT with `command: ["mattermost"]`.
	// In that case this wrapper is found first on PATH and must invoke the real server binary.
	if filepath.Base(args[0]) == "mattermost" {
		return append([]string{defaultMattermostBinary}, args[1:]...), nil
	}

	if len(args) < 2 {
		return nil, fmt.Errorf("no Mattermost command supplied")
	}

	commandArgs := append([]string(nil), args[1:]...)
	if filepath.Base(commandArgs[0]) == "mattermost" {
		commandArgs[0] = defaultMattermostBinary
	}
	return commandArgs, nil
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
