// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

var (
	// ErrReadOnlyConfiguration is returned when an attempt to modify a read-only configuration is made.
	ErrReadOnlyConfiguration = errors.New("configuration is read-only")
)

// FileStore is a config store backed by a file such as config/config.json.
//
// It also uses the folder containing the configuration file for storing other configuration files.
type FileStore struct {
	commonStore

	path    string
	watch   bool
	watcher *watcher
}

// NewFileStore creates a new instance of a config store backed by the given file path.
//
// If watch is true, any external changes to the file will force a reload.
func NewFileStore(path string, watch bool) (fs *FileStore, err error) {
	resolvedPath, err := resolveConfigFilePath(path)
	if err != nil {
		return nil, err
	}

	fs = &FileStore{
		path:  resolvedPath,
		watch: watch,
	}
	if err = fs.Load(); err != nil {
		return nil, errors.Wrap(err, "failed to load")
	}

	if fs.watch {
		if err = fs.startWatcher(); err != nil {
			mlog.Error("failed to start config watcher", mlog.String("path", path), mlog.Err(err))
		}
	}

	return fs, nil
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

	// Otherwise, search for the config/ folder using the same heuristics as above, and build
	// an absolute path anchored there and joining the given input path (or plain filename).
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
func (fs *FileStore) Set(newCfg *model.Config) (*model.Config, error) {
	return fs.commonStore.set(newCfg, true, func(cfg *model.Config) error {
		if *fs.config.ClusterSettings.Enable && *fs.config.ClusterSettings.ReadOnlyConfig {
			return ErrReadOnlyConfiguration
		}

		return fs.commonStore.validate(cfg)
	}, fs.persist)
}

// persist writes the configuration to the configured file.
func (fs *FileStore) persist(cfg *model.Config) error {
	fs.stopWatcher()

	b, err := marshalConfig(cfg)
	if err != nil {
		return errors.Wrap(err, "failed to serialize")
	}

	err = ioutil.WriteFile(fs.path, b, 0600)
	if err != nil {
		return errors.Wrap(err, "failed to write file")
	}

	if fs.watch {
		if err = fs.startWatcher(); err != nil {
			mlog.Error("failed to start config watcher", mlog.String("path", fs.path), mlog.Err(err))
		}
	}

	return nil
}

// Load updates the current configuration from the backing store.
func (fs *FileStore) Load() (err error) {
	var needsSave bool
	var f io.ReadCloser

	f, err = os.Open(fs.path)
	if os.IsNotExist(err) {
		needsSave = true
		defaultCfg := &model.Config{}
		defaultCfg.SetDefaults()

		var defaultCfgBytes []byte
		defaultCfgBytes, err = marshalConfig(defaultCfg)
		if err != nil {
			return errors.Wrap(err, "failed to serialize default config")
		}

		f = ioutil.NopCloser(bytes.NewReader(defaultCfgBytes))

	} else if err != nil {
		return errors.Wrapf(err, "failed to open %s for reading", fs.path)
	}
	defer func() {
		closeErr := f.Close()
		if err == nil && closeErr != nil {
			err = errors.Wrap(closeErr, "failed to close")
		}
	}()

	return fs.commonStore.load(f, needsSave, fs.commonStore.validate, fs.persist)
}

// GetFile fetches the contents of a previously persisted configuration file.
func (fs *FileStore) GetFile(name string) ([]byte, error) {
	resolvedPath := fs.resolveFilePath(name)

	data, err := ioutil.ReadFile(resolvedPath)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to read file from %s", resolvedPath)
	}

	return data, nil
}

// SetFile sets or replaces the contents of a configuration file.
func (fs *FileStore) SetFile(name string, data []byte) error {
	resolvedPath := fs.resolveFilePath(name)

	err := ioutil.WriteFile(resolvedPath, data, 0600)
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
	resolvedPath := filepath.Join(filepath.Dir(fs.path), name)

	err := os.Remove(resolvedPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return errors.Wrap(err, "failed to remove file")
	}

	return err
}

// startWatcher starts a watcher to monitor for external config file changes.
func (fs *FileStore) startWatcher() error {
	if fs.watcher != nil {
		return nil
	}

	watcher, err := newWatcher(fs.path, func() {
		if err := fs.Load(); err != nil {
			mlog.Error("failed to reload file on change", mlog.String("path", fs.path), mlog.Err(err))
		}
	})
	if err != nil {
		return err
	}

	fs.watcher = watcher

	return nil
}

// stopWatcher stops any previously started watcher.
func (fs *FileStore) stopWatcher() {
	if fs.watcher == nil {
		return
	}

	if err := fs.watcher.Close(); err != nil {
		mlog.Error("failed to close watcher", mlog.Err(err))
	}
	fs.watcher = nil
}

// String returns the path to the file backing the config.
func (fs *FileStore) String() string {
	return "file://" + fs.path
}

// Close cleans up resources associated with the store.
func (fs *FileStore) Close() error {
	fs.configLock.Lock()
	defer fs.configLock.Unlock()

	fs.stopWatcher()

	return nil
}
