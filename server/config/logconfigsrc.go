// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

type LogSrcListener func(old, new mlog.LoggerConfiguration)

// LogConfigSrc abstracts the Advanced Logging configuration so that implementations can
// fetch from file, database, etc.
type LogConfigSrc interface {
	// Get fetches the current, cached configuration.
	Get() mlog.LoggerConfiguration

	// Set updates the dsn specifying the source and reloads
	Set(dsn string, configStore *Store) (err error)

	// Close cleans up resources.
	Close() error
}

// NewLogConfigSrc creates an advanced logging configuration source, backed by a
// file, JSON string, or database.
func NewLogConfigSrc(dsn string, configStore *Store) (LogConfigSrc, error) {
	if dsn == "" {
		return nil, errors.New("dsn should not be empty")
	}

	if configStore == nil {
		return nil, errors.New("configStore should not be nil")
	}

	dsn = strings.TrimSpace(dsn)

	if isJSONMap(dsn) {
		return newJSONSrc(dsn)
	}

	path := dsn
	// If this is a file based config we need the full path so it can be watched.
	if strings.HasPrefix(configStore.String(), "file://") && !filepath.IsAbs(dsn) {
		configPath := strings.TrimPrefix(configStore.String(), "file://")
		path = filepath.Join(filepath.Dir(configPath), dsn)
	}

	return newFileSrc(path, configStore)
}

// jsonSrc

type jsonSrc struct {
	logSrcEmitter
	mutex sync.RWMutex
	cfg   mlog.LoggerConfiguration
}

func newJSONSrc(data string) (*jsonSrc, error) {
	src := &jsonSrc{}
	return src, src.Set(data, nil)
}

// Get fetches the current, cached configuration
func (src *jsonSrc) Get() mlog.LoggerConfiguration {
	src.mutex.RLock()
	defer src.mutex.RUnlock()
	return src.cfg
}

// Set updates the JSON specifying the source and reloads
func (src *jsonSrc) Set(data string, _ *Store) error {
	cfg, err := logTargetCfgFromJSON([]byte(data))
	if err != nil {
		return err
	}

	src.set(cfg)
	return nil
}

func (src *jsonSrc) set(cfg mlog.LoggerConfiguration) {
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
	mutex sync.RWMutex
	cfg   mlog.LoggerConfiguration
	path  string
}

func newFileSrc(path string, configStore *Store) (*fileSrc, error) {
	src := &fileSrc{
		path: path,
	}
	if err := src.Set(path, configStore); err != nil {
		return nil, err
	}
	return src, nil
}

// Get fetches the current, cached configuration
func (src *fileSrc) Get() mlog.LoggerConfiguration {
	src.mutex.RLock()
	defer src.mutex.RUnlock()
	return src.cfg
}

// Set updates the dsn specifying the file source and reloads.
// The file will be watched for changes and reloaded as needed,
// and all listeners notified.
func (src *fileSrc) Set(path string, configStore *Store) error {
	data, err := configStore.GetFile(path)
	if err != nil {
		return err
	}

	cfg, err := logTargetCfgFromJSON(data)
	if err != nil {
		return err
	}

	src.set(cfg)
	return nil
}

func (src *fileSrc) set(cfg mlog.LoggerConfiguration) {
	src.mutex.Lock()
	defer src.mutex.Unlock()

	src.cfg = cfg
}

// Close cleans up resources.
func (src *fileSrc) Close() error {
	return nil
}

func logTargetCfgFromJSON(data []byte) (mlog.LoggerConfiguration, error) {
	cfg := make(mlog.LoggerConfiguration)
	err := json.Unmarshal(data, &cfg)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}
