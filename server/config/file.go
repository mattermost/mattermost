// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"syscall"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

var (
	// ErrReadOnlyConfiguration is returned when an attempt to modify a read-only configuration is made.
	ErrReadOnlyConfiguration = errors.New("configuration is read-only")
)

// FileStore is a config store backed by a file such as config/config.json.
//
// It also uses the folder containing the configuration file for storing other configuration files.
// Not to be used directly. Only to be used as a backing store for config.Store
type FileStore struct {
	path string

	// createdEmpty is set when we created the (empty) config file ourselves in NewFileStore
	// and haven't written to it yet. That's the only time an empty file means a new install.
	createdEmpty bool
}

// NewFileStore creates a new instance of a config store backed by the given file path.
func NewFileStore(path string, createFileIfNotExists bool) (fs *FileStore, err error) {
	resolvedPath, err := resolveConfigFilePath(path)
	if err != nil {
		return nil, err
	}

	createdEmpty := false
	f, err := os.Open(resolvedPath)
	if err != nil && errors.Is(err, os.ErrNotExist) && createFileIfNotExists {
		file, err2 := os.Create(resolvedPath)
		if err2 != nil {
			return nil, fmt.Errorf("could not create config file: %w", err2)
		}
		defer file.Close()
		createdEmpty = true
	} else if err != nil {
		return nil, err
	} else {
		defer f.Close()
	}

	return &FileStore{
		path:         resolvedPath,
		createdEmpty: createdEmpty,
	}, nil
}

// resolveConfigFilePath attempts to resolve the given configuration file path to an absolute path.
//
// Consideration is given to maintaining backwards compatibility when resolving the path to the
// configuration file.
func resolveConfigFilePath(path string) (string, error) {
	// Absolute paths are explicit and require no resolution.
	if filepath.IsAbs(path) {
		return path, nil
	}

	// Search for the relative path to the file in the channels/config folder, taking into account
	// various common starting points.
	if configFile := fileutils.FindFile(filepath.Join("channels/config", path)); configFile != "" {
		return configFile, nil
	}

	// Search for the relative path to the file in the config folder, taking into account
	// various common starting points.
	if configFile := fileutils.FindFile(filepath.Join("config", path)); configFile != "" {
		return configFile, nil
	}

	// Search for the relative path in the current working directory, also taking into account
	// various common starting points.
	if configFile := fileutils.FindPath(path, []string{"."}, nil); configFile != "" {
		return configFile, nil
	}

	if configFolder, found := fileutils.FindDir("config"); found {
		return filepath.Join(configFolder, path), nil
	}

	// Fail altogether if we can't even find the config/ folder. This should only happen if
	// the executable is relocated away from the supporting files.
	return "", fmt.Errorf("failed to find config file %s", path)
}

// resolveFilePath uses the name if name is absolute path.
// otherwise returns the combined path/name
func (fs *FileStore) resolveFilePath(name string) string {
	// Absolute paths are explicit and require no resolution.
	if filepath.IsAbs(name) {
		return name
	}
	return filepath.Join(filepath.Dir(fs.path), name)
}

// Set replaces the current configuration in its entirety and updates the backing store.
func (fs *FileStore) Set(newCfg *model.Config) error {
	if *newCfg.ClusterSettings.Enable && *newCfg.ClusterSettings.ReadOnlyConfig {
		return ErrReadOnlyConfiguration
	}

	return fs.persist(newCfg)
}

// persist writes the configuration to the configured file.
func (fs *FileStore) persist(cfg *model.Config) error {
	b, err := marshalConfig(cfg)
	if err != nil {
		return errors.Wrap(err, "failed to serialize")
	}

	// The config is written back on every startup, usually with nothing changed. Skipping
	// those writes means we only touch the file when we actually have to.
	if current, readErr := os.ReadFile(fs.path); readErr == nil && bytes.Equal(current, b) {
		return nil
	}

	err = writeFileAtomically(fs.path, b)
	if err != nil {
		return errors.Wrap(err, "failed to write file")
	}
	fs.createdEmpty = false

	return nil
}

// writeFileAtomically writes data to a temp file next to path and then renames it into place,
// so a failed write (a full disk, say) leaves the old file as it was instead of truncating it.
func writeFileAtomically(path string, data []byte) error {
	// If path is a symlink, replace the file it points to and keep the link.
	target, err := filepath.EvalSymlinks(path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}
		target = path
	}

	perm := os.FileMode(0600)
	if info, statErr := os.Stat(target); statErr == nil {
		perm = info.Mode().Perm()
	}

	tmp, err := os.CreateTemp(filepath.Dir(target), "."+filepath.Base(target)+".tmp-*")
	if err != nil {
		// We can't create files in the directory, but the config file itself may still be
		// writable (e.g. only config.json is mounted into a container). Write it in place
		// rather than failing outright.
		if errors.Is(err, os.ErrPermission) {
			return writeFileInPlace(target, data, perm)
		}
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err = tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Chmod(perm); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}

	if err = os.Rename(tmpName, target); err != nil {
		// You can't rename over a file that is itself a mount point (e.g. a bind-mounted
		// config.json), so write it in place instead. The temp file lives on a different
		// filesystem here, so writing it doesn't tell us anything about space on the target.
		if errors.Is(err, syscall.EBUSY) || errors.Is(err, syscall.EXDEV) {
			return writeFileInPlace(target, data, perm)
		}
		return err
	}

	// Sync the directory too, otherwise the rename itself can be lost if the machine goes
	// down right after. Not every platform lets you do this (Windows doesn't), so it's best effort.
	if dir, dirErr := os.Open(filepath.Dir(target)); dirErr == nil {
		_ = dir.Sync()
		dir.Close()
	}

	return nil
}

// writeFileInPlace overwrites path without truncating it first, for the cases where we can't
// swap in a temp file. The part that grows the file is written first, because that's the only
// part that needs new disk space. If it fails, we cut the file back to its old size and the old
// config is still there. Only then do we overwrite the existing bytes and trim any leftovers.
func writeFileInPlace(path string, data []byte, perm os.FileMode) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, perm)
	if err != nil {
		return err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return err
	}
	oldSize := info.Size()

	if int64(len(data)) > oldSize {
		if _, err = f.WriteAt(data[oldSize:], oldSize); err != nil {
			_ = f.Truncate(oldSize)
			return err
		}
		if err = f.Sync(); err != nil {
			_ = f.Truncate(oldSize)
			return err
		}
	}

	if _, err = f.WriteAt(data, 0); err != nil {
		return err
	}
	if err = f.Truncate(int64(len(data))); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	return f.Close()
}

// Load updates the current configuration from the backing store.
func (fs *FileStore) Load() ([]byte, error) {
	f, err := os.Open(fs.path)
	if os.IsNotExist(err) {
		return nil, nil
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to open %s for reading", fs.path)
	}
	defer f.Close()

	fileBytes, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	// If we didn't create this empty file ourselves, the config was most likely lost (a write
	// that failed half way, for example). Treating it as a new install would quietly reset
	// every setting to its default, so refuse to start and let the admin sort it out.
	if len(fileBytes) == 0 && !fs.createdEmpty {
		return nil, fmt.Errorf("config file %s is empty: restore it from a backup, or delete it to start with the default configuration", fs.path)
	}

	return fileBytes, nil
}

// GetFile fetches the contents of a previously persisted configuration file.
func (fs *FileStore) GetFile(name string) ([]byte, error) {
	resolvedPath := fs.resolveFilePath(name)

	data, err := os.ReadFile(resolvedPath)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read file from %s", resolvedPath)
	}

	return data, nil
}

// GetFilePath returns the resolved path of a configuration file.
// The file may not necessarily exist.
func (fs *FileStore) GetFilePath(name string) string {
	return fs.resolveFilePath(name)
}

// SetFile sets or replaces the contents of a configuration file.
func (fs *FileStore) SetFile(name string, data []byte) error {
	resolvedPath := fs.resolveFilePath(name)

	err := os.WriteFile(resolvedPath, data, 0600)
	if err != nil {
		return errors.Wrapf(err, "failed to write file to %s", resolvedPath)
	}

	return nil
}

// HasFile returns true if the given file was previously persisted.
func (fs *FileStore) HasFile(name string) (bool, error) {
	if name == "" {
		return false, nil
	}

	resolvedPath := fs.resolveFilePath(name)

	_, err := os.Stat(resolvedPath)
	if err != nil && os.IsNotExist(err) {
		return false, nil
	} else if err != nil {
		return false, errors.Wrap(err, "failed to check if file exists")
	}

	return true, nil
}

// RemoveFile removes a previously persisted configuration file.
func (fs *FileStore) RemoveFile(name string) error {
	if filepath.IsAbs(name) {
		// Don't delete absolute filenames, as may be mounted drive, etc.
		mlog.Debug("Skipping removal of configuration file with absolute path", mlog.String("filename", name))
		return nil
	}

	root, err := os.OpenRoot(filepath.Dir(fs.path))
	if err != nil {
		return errors.Wrap(err, "failed to open config directory")
	}
	defer root.Close()

	err = root.Remove(name)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return errors.Wrap(err, "failed to remove file")
	}

	return nil
}

// String returns the path to the file backing the config.
func (fs *FileStore) String() string {
	return "file://" + fs.path
}

// Close cleans up resources associated with the store.
func (fs *FileStore) Close() error {
	return nil
}
