// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"os"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

type LogSrcListener func(old, new mlog.LogTargetCfg)

type FileGetter interface {
	GetFile(name string) ([]byte, error)
}

// LogConfigSrc abstracts the Advanced Logging configuration so that implementations can
// fetch from file, database, etc.
type LogConfigSrc interface {
	// Get fetches the current, cached configuration.
	Get() mlog.LogTargetCfg

	// Set updates the dsn specifying the source and reloads
	Set(dsn string, fget FileGetter) (err error)

	// AddListener adds a callback function to invoke when the configuration is modified.
	AddListener(listener LogSrcListener) string

	// RemoveListener removes a callback function using an id returned from AddListener.
	RemoveListener(id string)

	// Close cleans up resources.
	Close() error
}

// NewLogConfigSrc creates an advanced logging configuration source, backed by a
// file, JSON string, or database.
func NewLogConfigSrc(dsn string, isJSON bool, fget FileGetter) (LogConfigSrc, error) {
	dsn = strings.TrimSpace(dsn)

	if isJSON {
		return newJSONSrc(dsn)
	}
	return newFileSrc(dsn, fget)
}

// jsonSrc

type jsonSrc struct {
	logSrcEmitter
	mutex sync.RWMutex
	cfg   mlog.LogTargetCfg
}

func newJSONSrc(data string) (*jsonSrc, error) {
	src := &jsonSrc{}
	return src, src.Set(data, nil)
}

// Get fetches the current, cached configuration
func (src *jsonSrc) Get() mlog.LogTargetCfg {
	src.mutex.RLock()
	defer src.mutex.RUnlock()
	return src.cfg
}

// Set updates the JSON specifying the source and reloads
func (src *jsonSrc) Set(data string, _ FileGetter) error {
	cfg, err := JSONToLogTargetCfg([]byte(data))
	if err != nil {
		return err
	}

	src.set(cfg)
	return nil
}

func (src *jsonSrc) set(cfg mlog.LogTargetCfg) {
	src.mutex.Lock()
	defer src.mutex.Unlock()

	old := src.cfg
	src.cfg = cfg
	src.invokeConfigListeners(old, cfg)
}

// Close cleans up resources.
func (src *jsonSrc) Close() error {
	return nil
}

// fileSrc

type fileSrc struct {
	logSrcEmitter
	mutex sync.RWMutex
	cfg   mlog.LogTargetCfg

	path    string
	watcher *watcher
}

func newFileSrc(path string, fget FileGetter) (*fileSrc, error) {
	src := &fileSrc{
		path: path,
	}
	if err := src.Set(path, fget); err != nil {
		return nil, err
	}
	return src, nil
}

// Get fetches the current, cached configuration
func (src *fileSrc) Get() mlog.LogTargetCfg {
	src.mutex.RLock()
	defer src.mutex.RUnlock()
	return src.cfg
}

// Set updates the dsn specifying the file source and reloads.
// The file will be watched for changes and reloaded as needed,
// and all listeners notified.
func (src *fileSrc) Set(path string, fget FileGetter) error {
	data, err := fget.GetFile(path)
	if err != nil {
		return err
	}

	cfg, err := JSONToLogTargetCfg(data)
	if err != nil {
		return err
	}

	src.set(cfg)

	// If path is a real file and not just the name of a database resource then watch it for changes.
	// Absolute paths are explicit and require no resolution.
	if _, err = os.Stat(path); os.IsNotExist(err) {
		return nil
	}

	src.mutex.Lock()
	defer src.mutex.Unlock()

	if src.watcher != nil {
		if err = src.watcher.Close(); err != nil {
			mlog.Error("Failed to close watcher", mlog.Err(err))
		}
		src.watcher = nil
	}

	watcher, err := newWatcher(path, func() {
		if serr := src.Set(path, fget); serr != nil {
			mlog.Error("Failed to reload file on change", mlog.String("path", path), mlog.Err(serr))
		}
	})
	if err != nil {
		return err
	}

	src.watcher = watcher

	return nil
}

func (src *fileSrc) set(cfg mlog.LogTargetCfg) {
	src.mutex.Lock()
	defer src.mutex.Unlock()

	old := src.cfg
	src.cfg = cfg
	src.invokeConfigListeners(old, cfg)
}

// Close cleans up resources.
func (src *fileSrc) Close() error {
	var err error
	src.mutex.Lock()
	defer src.mutex.Unlock()
	if src.watcher != nil {
		err = src.watcher.Close()
		src.watcher = nil
	}
	return err
}
