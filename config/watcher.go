// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"path/filepath"

	"github.com/fsnotify/fsnotify"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

// watcher monitors a file for changes
type watcher struct {
	emitter

	fsWatcher *fsnotify.Watcher
	close     chan struct{}
	closed    chan struct{}
}

// newWatcher creates a new instance of watcher to monitor for file changes.
func newWatcher(path string, callback func()) (w *watcher, err error) {
	fsWatcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create fsnotify watcher for %s", path)
	}

	path = filepath.Clean(path)

	// Watch the entire containing directory.
	configDir, _ := filepath.Split(path)
	if err := fsWatcher.Add(configDir); err != nil {
		if closeErr := fsWatcher.Close(); closeErr != nil {
			mlog.Error("failed to stop fsnotify watcher for %s", mlog.String("path", path), mlog.Err(closeErr))
		}
		return nil, errors.Wrapf(err, "failed to watch directory %s", configDir)
	}

	w = &watcher{
		fsWatcher: fsWatcher,
		close:     make(chan struct{}),
		closed:    make(chan struct{}),
	}

	go func() {
		defer close(w.closed)
		defer func() {
			if err := fsWatcher.Close(); err != nil {
				mlog.Error("failed to stop fsnotify watcher for %s", mlog.String("path", path))
			}
		}()

		for {
			select {
			case event := <-fsWatcher.Events:
				// We only care about the given file.
				if filepath.Clean(event.Name) == path {
					if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
						mlog.Info("Config file watcher detected a change", mlog.String("path", path))
						go callback()
					}
				}
			case err := <-fsWatcher.Errors:
				mlog.Error("Failed while watching config file", mlog.String("path", path), mlog.Err(err))
			case <-w.close:
				return
			}
		}
	}()

	return w, nil
}

func (w *watcher) Close() error {
	close(w.close)
	<-w.closed

	return nil
}
