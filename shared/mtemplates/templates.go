// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mtemplates

import (
	"bytes"
	"html/template"
	"io"
	"path/filepath"
	"sync/atomic"

	"github.com/fsnotify/fsnotify"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

type Templates struct {
	templates atomic.Value
	stop      chan struct{}
	stopped   chan struct{}
	watch     bool
}

type Data struct {
	Props map[string]interface{}
	Html  map[string]template.HTML
}

func NewFromTemplate(templates *template.Template) (*Templates, error) {
	ret := &Templates{
		stop:    make(chan struct{}),
		stopped: make(chan struct{}),
		watch:   false,
	}
	ret.templates.Store(templates)
	return ret, nil
}

func New(directory string, watch bool) (*Templates, error) {
	mlog.Debug("Parsing server templates", mlog.String("templates_directory", directory))

	ret := &Templates{
		stop:    make(chan struct{}),
		stopped: make(chan struct{}),
		watch:   watch,
	}

	htmlTemplates, err := template.ParseGlob(filepath.Join(directory, "*.html"))
	if err != nil {
		return nil, err
	}
	ret.templates.Store(htmlTemplates)

	if watch {
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			return nil, err
		}

		if err = watcher.Add(directory); err != nil {
			return nil, err
		}

		go func() {
			defer close(ret.stopped)
			defer watcher.Close()

			for {
				select {
				case <-ret.stop:
					return
				case event := <-watcher.Events:
					if event.Op&fsnotify.Write == fsnotify.Write {
						mlog.Info("Re-parsing templates because of modified file", mlog.String("file_name", event.Name))
						if htmlTemplates, err := template.ParseGlob(filepath.Join(directory, "*.html")); err != nil {
							mlog.Error("Failed to parse templates.", mlog.Err(err))
						} else {
							ret.templates.Store(htmlTemplates)
						}
					}
				case err := <-watcher.Errors:
					mlog.Error("Failed in directory watcher", mlog.Err(err))
				}
			}
		}()
	}

	return ret, nil
}

func (t *Templates) Templates() *template.Template {
	return t.templates.Load().(*template.Template)
}

func (t *Templates) Close() {
	if t.watch {
		close(t.stop)
		<-t.stopped
	}
}

func (t *Templates) Render(templateName string, data *Data) string {
	var text bytes.Buffer
	t.RenderToWriter(&text, templateName, data)
	return text.String()
}

func (t *Templates) RenderToWriter(w io.Writer, templateName string, data *Data) error {
	if err := t.Templates().ExecuteTemplate(w, templateName, data); err != nil {
		mlog.Warn("Error rendering template", mlog.String("template_name", templateName), mlog.Err(err))
		return err
	}

	return nil
}
