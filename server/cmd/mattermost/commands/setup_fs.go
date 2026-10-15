// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net"
	"os"
	"path/filepath"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

func createProbeFile(dir string) error {
	file, err := os.CreateTemp(dir, ".mm-setup-probe-*")
	if err != nil {
		return err
	}
	name := file.Name()
	if err := file.Close(); err != nil {
		_ = os.Remove(name)
		return err
	}
	return os.Remove(name)
}

func probeDirWritable(dir string, uid, gid int) error {
	if os.Geteuid() == uid {
		return createProbeFile(dir)
	}
	return probeDirWritableAs(dir, uid, gid)
}

func ensureRuntimeDirs(dirs []string, uid, gid int) error {
	for _, dir := range dirs {
		if err := mkdirOwned(dir, uid, gid); err != nil {
			return err
		}
		if err := probeDirWritable(dir, uid, gid); err != nil {
			return errors.Errorf("%s is not writable by the mattermost user (owner %s). Run: chown %s:%s %s", dir, fileOwner(dir), mattermostUser, mattermostUser, dir)
		}
	}
	return nil
}

// mkdirOwned creates dir when it is missing and chowns only the directories this
// call created. Existing directories, including the install root, are left alone.
func mkdirOwned(dir string, uid, gid int) error {
	dir = filepath.Clean(dir)
	var created []string
	cur := dir
	for {
		if _, err := os.Stat(cur); err == nil {
			break
		} else if !os.IsNotExist(err) {
			return errors.Wrapf(err, "cannot stat %s", cur)
		}
		created = append(created, cur)
		parent := filepath.Dir(cur)
		if parent == cur {
			break
		}
		cur = parent
	}
	if len(created) == 0 {
		return nil
	}
	if err := os.MkdirAll(dir, 0750); err != nil {
		return errors.Wrapf(err, "cannot create %s", dir)
	}
	if os.Geteuid() != 0 {
		return nil
	}
	for i := len(created) - 1; i >= 0; i-- {
		if err := os.Chown(created[i], uid, gid); err != nil {
			return errors.Wrapf(err, "cannot chown %s", created[i])
		}
	}
	return nil
}

type modelConfigDirs struct {
	data          string
	logs          string
	plugins       string
	clientPlugins string
}

func runtimeDirs(root string, cfg *modelConfigDirs) []string {
	data := model.FileSettingsDefaultDirectory
	logs := "logs"
	plugins := model.PluginSettingsDefaultDirectory
	client := model.PluginSettingsDefaultClientDirectory
	if cfg != nil {
		if cfg.data != "" {
			data = cfg.data
		}
		if cfg.logs != "" {
			logs = cfg.logs
		}
		if cfg.plugins != "" {
			plugins = cfg.plugins
		}
		if cfg.clientPlugins != "" {
			client = cfg.clientPlugins
		}
	}
	return []string{
		resolveUnderRoot(root, data),
		resolveUnderRoot(root, logs),
		resolveUnderRoot(root, plugins),
		resolveUnderRoot(root, client),
	}
}

func resolveUnderRoot(root, path string) string {
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	return filepath.Join(root, filepath.Clean(path))
}

func writeEnvFile(path, contents string) error {
	if existing, err := os.ReadFile(path); err == nil && string(existing) == contents {
		if err := os.Chmod(path, 0600); err != nil {
			return err
		}
		chownRoot(path)
		return nil
	} else if err != nil && !os.IsNotExist(err) {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".mattermost.env.*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(tmpName)
		}
	}()
	if err := tmp.Chmod(0600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.WriteString(contents); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	cleanup = false
	if err := os.Chmod(path, 0600); err != nil {
		return err
	}
	chownRoot(path)
	return nil
}

func chownRoot(path string) {
	if os.Geteuid() == 0 {
		_ = os.Chown(path, 0, 0)
	}
}

func readEnvValues(path string) (map[string]string, bool, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return parseEnvFile(string(data)), true, nil
}

func existingConfigFile(root string) (string, bool) {
	for _, path := range []string{
		filepath.Join(root, "config", "config.json"),
		filepath.Join(root, "config.json"),
	} {
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() {
			return path, true
		}
	}
	return "", false
}

func detectInstallRoot() string {
	exe, err := os.Executable()
	if err != nil {
		return "/opt/mattermost"
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	dir := filepath.Dir(exe)
	if filepath.Base(dir) == "bin" {
		return filepath.Dir(dir)
	}
	return "/opt/mattermost"
}

func bindAndClose(network, address string) error {
	switch network {
	case "tcp":
		ln, err := net.Listen(network, address)
		if err != nil {
			return err
		}
		return ln.Close()
	case "udp":
		pc, err := net.ListenPacket(network, address)
		if err != nil {
			return err
		}
		return pc.Close()
	default:
		return errors.Errorf("unsupported network %s", network)
	}
}
