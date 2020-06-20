// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"context"
	"encoding/json"
	"errors"
	"io/ioutil"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

type LogSrcListener func(old, new mlog.LogTargetCfg)
type shutdownHook func(context.Context) error

// LogConfigSrc abstracts the Advanced Logging configuration so that implementations can
// fetch from file, database, etc.
type LogConfigSrc interface {
	// Get fetches the current, cached configuration.
	Get() mlog.LogTargetCfg

	// Set updates the dsn specifying the source and reloads
	Set(dsn string) (err error)

	// AddListener adds a callback function to invoke when the configuration is modified.
	AddListener(listener LogSrcListener) string

	// RemoveListener removes a callback function using an id returned from AddListener.
	RemoveListener(id string)

	// Close cleans up resources.
	Close() error
}

// NewLogConfigSrc creates an advanced logging configuration source, backed by a
// file, JSON string, or database.
func NewLogConfigSrc(dsn string) (LogConfigSrc, error) {
	dsn = strings.TrimSpace(dsn)

	if IsJsonMap(dsn) {
		return newJSONSrc(dsn)
	}

	if strings.HasPrefix(dsn, "mysql://") || strings.HasPrefix(dsn, "postgres://") {
		return newDatabaseSrc(dsn)
	}

	return newFileSrc(dsn)
}

// commonSrc

type commonSrc struct {
	logSrcEmitter
	mutex sync.RWMutex
	cfg   mlog.LogTargetCfg
}

// Get fetches the current, cached configuration
func (src *commonSrc) Get() mlog.LogTargetCfg {
	src.mutex.RLock()
	defer src.mutex.RUnlock()
	return src.cfg
}

func (src *commonSrc) set(cfg mlog.LogTargetCfg) {
	src.mutex.Lock()
	defer src.mutex.Unlock()

	old := src.cfg
	src.cfg = cfg
	src.invokeConfigListeners(old, cfg)
}

// jsonSrc

type jsonSrc struct {
	commonSrc
}

func newJSONSrc(dsn string) (*jsonSrc, error) {
	src := &jsonSrc{}
	return src, src.Set(dsn)
}

// Set updates the dsn specifying the source and reloads
func (src *jsonSrc) Set(dsn string) error {
	cfg := make(mlog.LogTargetCfg)
	err := json.Unmarshal([]byte(dsn), &cfg)
	if err != nil {
		return err
	}

	src.set(cfg)
	return nil
}

// Close cleans up resources.
func (src *jsonSrc) Close() error {
	return nil
}

// fileSrc

type fileSrc struct {
	commonSrc
	watcher *watcher
}

func newFileSrc(dsn string) (*fileSrc, error) {
	src := &fileSrc{}
	return src, src.Set(dsn)
}

// Set updates the dsn specifying the file source and reloads.
// The file will be watched for changes and reloaded as needed,
// and all listeners notified.
func (src *fileSrc) Set(dsn string) error {
	path, err := resolveConfigFilePath(dsn)
	if err != nil {
		return err
	}

	data, err := ioutil.ReadFile(path)
	if err != nil {
		return err
	}

	cfg := make(mlog.LogTargetCfg)
	if err = json.Unmarshal(data, &cfg); err != nil {
		return err
	}

	watcher, err := newWatcher(path, func() {
		if serr := src.Set(path); serr != nil {
			mlog.Error("failed to reload file on change", mlog.String("path", path), mlog.Err(serr))
		}
	})
	if err != nil {
		return err
	}

	src.set(cfg)

	src.mutex.Lock()
	defer src.mutex.Unlock()
	if src.watcher != nil {
		if err := src.watcher.Close(); err != nil {
			mlog.Error("failed to close watcher", mlog.Err(err))
		}
	}
	src.watcher = watcher

	return nil
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

// databaseSrc

type databaseSrc struct {
	commonSrc
}

func newDatabaseSrc(dsn string) (*databaseSrc, error) {
	src := &databaseSrc{}
	return src, src.Set(dsn)
}

// Set updates the dsn specifying the database source and reloads.
func (src *databaseSrc) Set(dsn string) error {
	//src.set(cfg)
	return errors.New("database source not implemented yet")
}

// Close cleans up resources.
func (src *databaseSrc) Close() error {
	return nil
}
