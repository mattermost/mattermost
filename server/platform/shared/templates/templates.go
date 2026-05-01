// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package templates

import (
	"bytes"
	"html/template"
	"io"
	"path/filepath"
	"sync"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

// Container represents a set of templates that can be render
type Container struct {
	templates *template.Template
	mutex     sync.RWMutex
}

// Data contains the data used to populate the template variables, it has Props
// that can be of any type and HTML that only can be `template.HTML` types.
type Data struct {
	Props map[string]any
	HTML  map[string]template.HTML
}

func GetTemplateDirectory() (string, bool) {
	return fileutils.FindDir("templates")
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

	if err := htmlTemplates.ExecuteTemplate(w, templateName, data); err != nil {
		return err
	}

	return nil
}
