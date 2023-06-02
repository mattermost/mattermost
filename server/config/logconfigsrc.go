// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

const (
	LogConfigSrcTypeJSON LogConfigSrcType = "json"
	LogConfigSrcTypeFile LogConfigSrcType = "file"
)

type LogSrcListener func(old, new mlog.LoggerConfiguration)
type LogConfigSrcType string

// LogConfigSrc abstracts the Advanced Logging configuration so that implementations can
// fetch from file, database, etc.
type LogConfigSrc interface {
	// Get fetches the current, cached configuration.
	Get() mlog.LoggerConfiguration

	// Set updates the dsn specifying the source and reloads
	Set(dsn []byte, configStore *Store) (err error)

	// GetType returns the type of config source (JSON, file, ...)
	GetType() LogConfigSrcType

	// Close cleans up resources.
	Close() error
}

// NewLogConfigSrc creates an advanced logging configuration source, backed by a
// file, JSON string, or database.
func NewLogConfigSrc(dsn json.RawMessage, configStore *Store) (LogConfigSrc, error) {
	if len(dsn) == 0 {
		return nil, errors.New("dsn should not be empty")
	}

	if configStore == nil {
		return nil, errors.New("configStore should not be nil")
	}

	//  check if embedded JSON
	if isJSONMap(dsn) {
		return newJSONSrc(dsn)
	}

	// Now we're treating the DSN as a string which may contain escaped JSON or be a filespec.
	str := strings.TrimSpace(string(dsn))
	if s, err := strconv.Unquote(str); err == nil {
		str = s
	}

	// check if escaped JSON
	strBytes := []byte(str)
	if isJSONMap(strBytes) {
		return newJSONSrc(strBytes)
	}

	// If this is a file based config we need the full path so it can be watched.
	path := str
	if strings.HasPrefix(configStore.String(), "file://") && !filepath.IsAbs(path) {
		configPath := strings.TrimPrefix(configStore.String(), "file://")
		path = filepath.Join(filepath.Dir(configPath), path)
	}

	return newFileSrc(path, configStore)
}

// jsonSrc

type jsonSrc struct {
	logSrcEmitter
	mutex sync.RWMutex
	cfg   mlog.LoggerConfiguration
}

func newJSONSrc(data json.RawMessage) (*jsonSrc, error) {
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
func (src *jsonSrc) Set(data []byte, _ *Store) error {
	cfg, err := logTargetCfgFromJSON(data)
	if err != nil {
		return err
	}

	src.set(cfg)
	return nil
}

// GetType returns the config source type.
func (src *jsonSrc) GetType() LogConfigSrcType {
	return LogConfigSrcTypeJSON
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
	if err := src.Set([]byte(path), configStore); err != nil {
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
func (src *fileSrc) Set(path []byte, configStore *Store) error {
	data, err := configStore.GetFile(string(path))
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

// GetType returns the config source type.
func (src *fileSrc) GetType() LogConfigSrcType {
	return LogConfigSrcTypeFile
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
