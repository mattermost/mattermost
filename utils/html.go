// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"html/template"
	"io"
	"reflect"
	"sync/atomic"

	l4g "github.com/alecthomas/log4go"
	"github.com/fsnotify/fsnotify"
	"github.com/nicksnyder/go-i18n/i18n"
)

type HTMLTemplateWatcher struct {
	templates atomic.Value
	stop      chan struct{}
	stopped   chan struct{}
}

func NewHTMLTemplateWatcher(directory string) (*HTMLTemplateWatcher, error) {
	templatesDir, _ := FindDir(directory)
	l4g.Debug(T("api.api.init.parsing_templates.debug"), templatesDir)

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

	if htmlTemplates, err := template.ParseGlob(templatesDir + "*.html"); err != nil {
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
					l4g.Info(T("web.reparse_templates.info"), event.Name)
					if htmlTemplates, err := template.ParseGlob(templatesDir + "*.html"); err != nil {
						l4g.Error(T("web.parsing_templates.error"), err)
					} else {
						ret.templates.Store(htmlTemplates)
					}
				}
			case err := <-watcher.Errors:
				l4g.Error(T("web.dir_fail.error"), err)
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
	if err := t.Templates.ExecuteTemplate(w, t.TemplateName, t); err != nil {
		l4g.Error(T("api.api.render.error"), t.TemplateName, err)
		return err
	}

	return nil
}

func TranslateAsHtml(t i18n.TranslateFunc, translationID string, args map[string]interface{}) template.HTML {
	return template.HTML(t(translationID, escapeForHtml(args)))
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
		l4g.Warn("Unable to escape value for HTML template %v of type %v", arg, reflect.ValueOf(arg).Type())
		return ""
	}
}
