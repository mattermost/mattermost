// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"html/template"
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/fsnotify/fsnotify"
	"github.com/nicksnyder/go-i18n/i18n"
)

// Global storage for templates
var htmlTemplates *template.Template

type HTMLTemplate struct {
	TemplateName string
	Props        map[string]interface{}
	Html         map[string]template.HTML
	Locale       string
}

func InitHTML() {
	InitHTMLWithDir("templates")
}

func InitHTMLWithDir(dir string) {

	if htmlTemplates != nil {
		return
	}

	templatesDir, _ := FindDir(dir)
	l4g.Debug(T("api.api.init.parsing_templates.debug"), templatesDir)
	var err error
	if htmlTemplates, err = template.ParseGlob(templatesDir + "*.html"); err != nil {
		l4g.Error(T("api.api.init.parsing_templates.error"), err)
	}

	// Watch the templates folder for changes.
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		l4g.Error(T("web.create_dir.error"), err)
	}

	go func() {
		for {
			select {
			case event := <-watcher.Events:
				if event.Op&fsnotify.Write == fsnotify.Write {
					l4g.Info(T("web.reparse_templates.info"), event.Name)
					if htmlTemplates, err = template.ParseGlob(templatesDir + "*.html"); err != nil {
						l4g.Error(T("web.parsing_templates.error"), err)
					}
				}
			case err := <-watcher.Errors:
				l4g.Error(T("web.dir_fail.error"), err)
			}
		}
	}()

	err = watcher.Add(templatesDir)
	if err != nil {
		l4g.Error(T("web.watcher_fail.error"), err)
	}
}

func NewHTMLTemplate(templateName string, locale string) *HTMLTemplate {
	return &HTMLTemplate{
		TemplateName: templateName,
		Props:        make(map[string]interface{}),
		Html:         make(map[string]template.HTML),
		Locale:       locale,
	}
}

func (t *HTMLTemplate) addDefaultProps() {
	var localT i18n.TranslateFunc
	if len(t.Locale) > 0 {
		localT = GetUserTranslations(t.Locale)
	} else {
		localT = T
	}

	t.Props["Footer"] = localT("api.templates.email_footer")

	if *Cfg.EmailSettings.FeedbackOrganization != "" {
		t.Props["Organization"] = localT("api.templates.email_organization") + *Cfg.EmailSettings.FeedbackOrganization
	} else {
		t.Props["Organization"] = ""
	}

	t.Html["EmailInfo"] = template.HTML(localT("api.templates.email_info",
		map[string]interface{}{"SupportEmail": Cfg.SupportSettings.SupportEmail, "SiteName": Cfg.TeamSettings.SiteName}))
}

func (t *HTMLTemplate) Render() string {
	t.addDefaultProps()

	var text bytes.Buffer

	if err := htmlTemplates.ExecuteTemplate(&text, t.TemplateName, t); err != nil {
		l4g.Error(T("api.api.render.error"), t.TemplateName, err)
	}

	return text.String()
}

func (t *HTMLTemplate) RenderToWriter(w http.ResponseWriter) error {
	t.addDefaultProps()

	if err := htmlTemplates.ExecuteTemplate(w, t.TemplateName, t); err != nil {
		l4g.Error(T("api.api.render.error"), t.TemplateName, err)
		return err
	}
	return nil
}
