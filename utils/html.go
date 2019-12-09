// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"errors"
	"html/template"
	"io"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"

	"github.com/fsnotify/fsnotify"
	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

type HTMLTemplateWatcher struct {
	templates atomic.Value
	stop      chan struct{}
	stopped   chan struct{}
}

func NewHTMLTemplateWatcher(directory string) (*HTMLTemplateWatcher, error) {
	templatesDir, _ := fileutils.FindDir(directory)
	mlog.Debug("Parsing server templates", mlog.String("templates_directory", templatesDir))

	ret := &HTMLTemplateWatcher{
		stop:    make(chan struct{}),
		stopped: make(chan struct{}),
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	if err = watcher.Add(templatesDir); err != nil {
		return nil, err
	}

	if htmlTemplates, err := template.ParseGlob(filepath.Join(templatesDir, "*.html")); err != nil {
		return nil, err
	} else {
		ret.templates.Store(htmlTemplates)
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
					if htmlTemplates, err := template.ParseGlob(filepath.Join(templatesDir, "*.html")); err != nil {
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

	return ret, nil
}

func (w *HTMLTemplateWatcher) Templates() *template.Template {
	return w.templates.Load().(*template.Template)
}

func (w *HTMLTemplateWatcher) Close() {
	close(w.stop)
	<-w.stopped
}

type HTMLTemplate struct {
	Templates    *template.Template
	TemplateName string
	Props        map[string]interface{}
	Html         map[string]template.HTML
}

func NewHTMLTemplate(templates *template.Template, templateName string) *HTMLTemplate {
	return &HTMLTemplate{
		Templates:    templates,
		TemplateName: templateName,
		Props:        make(map[string]interface{}),
		Html:         make(map[string]template.HTML),
	}
}

func (t *HTMLTemplate) Render() string {
	var text bytes.Buffer
	t.RenderToWriter(&text)
	return text.String()
}

func (t *HTMLTemplate) RenderToWriter(w io.Writer) error {
	if t.Templates == nil {
		return errors.New("no html templates")
	}

	if err := t.Templates.ExecuteTemplate(w, t.TemplateName, t); err != nil {
		mlog.Error("Error rendering template", mlog.String("template_name", t.TemplateName), mlog.Err(err))
		return err
	}

	return nil
}

func TranslateAsHtml(t i18n.TranslateFunc, translationID string, args map[string]interface{}) template.HTML {
	message := t(translationID, escapeForHtml(args))
	message = strings.Replace(message, "[[", "<strong>", -1)
	message = strings.Replace(message, "]]", "</strong>", -1)
	return template.HTML(message)
}

func escapeForHtml(arg interface{}) interface{} {
	switch typedArg := arg.(type) {
	case string:
		return template.HTMLEscapeString(typedArg)
	case *string:
		return template.HTMLEscapeString(*typedArg)
	case map[string]interface{}:
		safeArg := make(map[string]interface{}, len(typedArg))
		for key, value := range typedArg {
			safeArg[key] = escapeForHtml(value)
		}
		return safeArg
	default:
		mlog.Warn(
			"Unable to escape value for HTML template",
			mlog.Any("html_template", arg),
			mlog.String("template_type", reflect.ValueOf(arg).Type().String()),
		)
		return ""
	}
}
