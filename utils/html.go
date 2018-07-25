// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"errors"
	"fmt"
	"html/template"
	"io"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"

	"github.com/fsnotify/fsnotify"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/nicksnyder/go-i18n/i18n"
)

type HTMLTemplateWatcher struct {
	templates atomic.Value
	stop      chan struct{}
	stopped   chan struct{}
}

func NewHTMLTemplateWatcher(directory string) (*HTMLTemplateWatcher, error) {
	templatesDir, _ := FindDir(directory)
	mlog.Debug(fmt.Sprintf("Parsing server templates at %v", templatesDir))

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
					mlog.Info(fmt.Sprintf("Re-parsing templates because of modified file %v", event.Name))
					if htmlTemplates, err := template.ParseGlob(filepath.Join(templatesDir, "*.html")); err != nil {
						mlog.Error(fmt.Sprintf("Failed to parse templates %v", err))
					} else {
						ret.templates.Store(htmlTemplates)
					}
				}
			case err := <-watcher.Errors:
				mlog.Error(fmt.Sprintf("Failed in directory watcher %s", err))
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
		mlog.Error(fmt.Sprintf("Error rendering template %v err=%v", t.TemplateName, err))
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
		mlog.Warn(fmt.Sprintf("Unable to escape value for HTML template %v of type %v", arg, reflect.ValueOf(arg).Type()))
		return ""
	}
}
