// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package templates

import (
	"bytes"
	"html/template"
	"io"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

// Container represents a set of templates that can be render
type Container struct {
	templates *template.Template
	mutex     sync.RWMutex
	stop      chan struct{}
	stopped   chan struct{}
	watch     bool
}

// Data contains the data used to populate the template variables, it has Props
// that can be of any type and HTML that only can be `template.HTML` types.
type Data struct {
	Props map[string]interface{}
	HTML  map[string]template.HTML
}

// NewFromTemplates creates a new templates container using a
// `template.Template` object
func NewFromTemplate(templates *template.Template) (*Container, error) {
	ret := &Container{
		templates: templates,
		stop:      make(chan struct{}),
		stopped:   make(chan struct{}),
		watch:     false,
	}
	return ret, nil
}

// NewFromTemplates creates a new templates container scanning a directory. It
// supports watching that directory to apply the filesystem changes to the
// loaded templates.
func New(directory string, watch bool) (*Container, error) {
	mlog.Debug("Parsing server templates", mlog.String("templates_directory", directory))

	ret := &Container{
		stop:    make(chan struct{}),
		stopped: make(chan struct{}),
		watch:   watch,
	}

	htmlTemplates, err := template.ParseGlob(filepath.Join(directory, "*.html"))
	if err != nil {
		return nil, err
	}
	ret.templates = htmlTemplates

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
							ret.mutex.Lock()
							ret.templates = htmlTemplates
							ret.mutex.Unlock()
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

func (t *Container) getTemplates() *template.Template {
	t.mutex.RLock()
	defer t.mutex.RUnlock()
	return t.templates
}

// Close stops the templates watcher of the container in case you have created
// it with watch parameter set to true
func (t *Container) Close() {
	if t.watch {
		close(t.stop)
		<-t.stopped
	}
}

// RenderToString renders the template referenced with the template name using
// the data provided and return a string with the result
func (t *Container) RenderToString(templateName string, data Data) string {
	var text bytes.Buffer
	t.Render(&text, templateName, data)
	return text.String()
}

// RenderToString renders the template referenced with the template name using
// the data provided and write it to the writer provided
func (t *Container) Render(w io.Writer, templateName string, data Data) error {
	if err := t.getTemplates().ExecuteTemplate(w, templateName, data); err != nil {
		mlog.Warn("Error rendering template", mlog.String("template_name", templateName), mlog.Err(err))
		return err
	}

	return nil
}
