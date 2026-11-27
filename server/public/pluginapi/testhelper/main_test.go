// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

//go:build integration

package testhelper

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

const testPluginSrc = "testdata/plugin"

// TestMain builds the plugin in testdata/plugin and points the helper at it, since
// this package, unlike a plugin repo, has no plugin.json or dist/ above it.
func TestMain(m *testing.M) {
	dir, err := buildTestPlugin()
	if err != nil {
		fmt.Fprintln(os.Stderr, "build test plugin:", err)
		os.Exit(1)
	}
	os.Setenv("MM_TEST_PLUGIN_DIR", dir)

	code := m.Run()
	os.RemoveAll(dir)
	os.Exit(code)
}

// buildTestPlugin lays out a temporary directory as the helper expects it,
// plugin.json and dist/<id>.tar.gz, and returns its path. The bundle holds
// executables for linux/amd64 and linux/arm64, so it also runs on arm64 Docker hosts.
func buildTestPlugin() (string, error) {
	id, err := getPluginID(testPluginSrc)
	if err != nil {
		return "", err
	}
	manifest, err := os.ReadFile(filepath.Join(testPluginSrc, "plugin.json"))
	if err != nil {
		return "", err
	}

	dir, err := os.MkdirTemp("", "testhelper-plugin")
	if err != nil {
		return "", err
	}
	if err = os.WriteFile(filepath.Join(dir, "plugin.json"), manifest, 0o600); err != nil {
		return "", err
	}
	if err = os.Mkdir(filepath.Join(dir, "dist"), 0o700); err != nil {
		return "", err
	}

	f, err := os.Create(filepath.Join(dir, "dist", id+".tar.gz"))
	if err != nil {
		return "", err
	}
	defer f.Close()
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)

	if err = addToTar(tw, id+"/plugin.json", manifest, 0o644); err != nil {
		return "", err
	}
	for _, arch := range []string{"amd64", "arm64"} {
		var bin []byte
		if bin, err = buildExecutable(dir, arch); err != nil {
			return "", err
		}
		if err = addToTar(tw, id+"/server/dist/plugin-linux-"+arch, bin, 0o755); err != nil {
			return "", err
		}
	}

	if err = tw.Close(); err != nil {
		return "", err
	}
	if err = gz.Close(); err != nil {
		return "", err
	}
	return dir, f.Close()
}

// buildExecutable cross-compiles the test plugin for linux/arch into dir and
// returns the binary.
func buildExecutable(dir, arch string) ([]byte, error) {
	path := filepath.Join(dir, "plugin-linux-"+arch)
	cmd := exec.Command("go", "build", "-o", path, "./"+testPluginSrc)
	cmd.Env = append(os.Environ(), "GOOS=linux", "GOARCH="+arch, "CGO_ENABLED=0")
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("go build for linux/%s: %w\n%s", arch, err, out)
	}
	return os.ReadFile(path)
}

func addToTar(tw *tar.Writer, name string, data []byte, mode int64) error {
	if err := tw.WriteHeader(&tar.Header{Name: name, Mode: mode, Size: int64(len(data)), Typeflag: tar.TypeReg}); err != nil {
		return err
	}
	_, err := tw.Write(data)
	return err
}
