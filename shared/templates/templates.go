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
func NewFromTemplate(templates *template.Template) *Container {
	return &Container{templates: templates}
}

// New creates a new templates container scanning a directory.
func New(directory string) (*Container, error) {
	c := &Container{}

	htmlTemplates, err := template.ParseGlob(filepath.Join(directory, "*.html"))
	if err != nil {
		return nil, err
	}
	c.templates = htmlTemplates

	return c, nil
}

// NewWithWatcher creates a new templates container scanning a directory and
// watch the directory filesystem changes to apply them to the loaded
// templates. The caller must consume the returned error channel to ensure not
// blocking the watch process.
func NewWithWatcher(directory string) (*Container, <-chan error) {
	errors := make(chan error)
	c := &Container{}

	htmlTemplates, err := template.ParseGlob(filepath.Join(directory, "*.html"))
	if err != nil {
		go func() {
			defer close(errors)
			errors <- err
		}()
		return nil, errors
	}
	c.templates = htmlTemplates

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		go func() {
			defer close(errors)
			errors <- err
		}()
		return c, errors
	}

	err = watcher.Add(directory)
	if err != nil {
		go func() {
			defer close(errors)
			errors <- err
		}()
		watcher.Close()
		return c, errors
	}

	c.watch = true
	c.stop = make(chan struct{})
	c.stopped = make(chan struct{})

	go func() {
		defer close(errors)
		defer close(c.stopped)
		defer watcher.Close()

		for {
			select {
			case <-c.stop:
				return
			case event := <-watcher.Events:
				if event.Op&fsnotify.Write == fsnotify.Write {
					if htmlTemplates, err := template.ParseGlob(filepath.Join(directory, "*.html")); err != nil {
						errors <- err
					} else {
						c.mutex.Lock()
						c.templates = htmlTemplates
						c.mutex.Unlock()
					}
				}
			case err := <-watcher.Errors:
				errors <- err
			}
		}
	}()

	return c, errors
}

// Close stops the templates watcher of the container in case you have created
// it with watch parameter set to true
func (c *Container) Close() {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	if c.watch {
		close(c.stop)
		<-c.stopped
	}
}

// RenderToString renders the template referenced with the template name using
// the data provided and return a string with the result
func (c *Container) RenderToString(templateName string, data Data) (string, error) {
	var text bytes.Buffer
	if err := c.Render(&text, templateName, data); err != nil {
		return "", err
	}
	return text.String(), nil
}

// RenderToString renders the template referenced with the template name using
// the data provided and write it to the writer provided
func (c *Container) Render(w io.Writer, templateName string, data Data) error {
	c.mutex.RLock()
	htmlTemplates := c.templates
	c.mutex.RUnlock()

	if htmlTemplates == nil {
		return nil
	}

	if err := htmlTemplates.ExecuteTemplate(w, templateName, data); err != nil {
		return err
	}

	return nil
}
