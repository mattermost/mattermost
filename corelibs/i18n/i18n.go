// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package i18n

import (
	"fmt"
	"html/template"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/mattermost/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

const defaultLocale = "en"

type TranslateFunc func(translationID string, args ...interface{}) string

var T TranslateFunc
var TDefault TranslateFunc
var locales map[string]string = make(map[string]string)
var defaultServerLocale string
var defaultClientLocale string

// this functions loads translations from filesystem if they are not
// loaded already and assigns english while loading server config
func TranslationsPreInit(translationsDir string) error {
	if T != nil {
		return nil
	}

	// Set T even if we fail to load the translations. Lots of shutdown handling code will
	// segfault trying to handle the error, and the untranslated IDs are strictly better.
	T = tfuncWithFallback(defaultLocale)
	TDefault = tfuncWithFallback(defaultLocale)

	return initTranslationsWithDir(translationsDir)
}

func InitTranslations(serverLocale, clientLocale string) error {
	defaultServerLocale = serverLocale
	defaultClientLocale = clientLocale

	var err error
	T, err = GetTranslationsBySystemLocale()
	return err
}

func initTranslationsWithDir(dir string) error {
	files, _ := ioutil.ReadDir(dir)
	for _, f := range files {
		if filepath.Ext(f.Name()) == ".json" {
			filename := f.Name()
			locales[strings.Split(filename, ".")[0]] = filepath.Join(dir, filename)

			if err := i18n.LoadTranslationFile(filepath.Join(dir, filename)); err != nil {
				return err
			}
		}
	}

	return nil
}

func GetTranslationsBySystemLocale() (TranslateFunc, error) {
	locale := defaultServerLocale
	if _, ok := locales[locale]; !ok {
		mlog.Warn("Failed to load system translations for", mlog.String("locale", locale), mlog.String("attempting to fall back to default locale", defaultLocale))
		locale = defaultLocale
	}

	if locales[locale] == "" {
		return nil, fmt.Errorf("Failed to load system translations for '%v'", defaultLocale)
	}

	translations := tfuncWithFallback(locale)
	if translations == nil {
		return nil, fmt.Errorf("Failed to load system translations")
	}

	mlog.Info("Loaded system translations", mlog.String("for locale", locale), mlog.String("from locale", locales[locale]))
	return translations, nil
}

func GetUserTranslations(locale string) TranslateFunc {
	if _, ok := locales[locale]; !ok {
		locale = defaultLocale
	}

	translations := tfuncWithFallback(locale)
	return translations
}

func GetTranslationsAndLocale(r *http.Request) (TranslateFunc, string) {
	// This is for checking against locales like pt_BR or zn_CN
	headerLocaleFull := strings.Split(r.Header.Get("Accept-Language"), ",")[0]
	// This is for checking against locales like en, es
	headerLocale := strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	defaultLocale := defaultClientLocale
	if locales[headerLocaleFull] != "" {
		translations := tfuncWithFallback(headerLocaleFull)
		return translations, headerLocaleFull
	} else if locales[headerLocale] != "" {
		translations := tfuncWithFallback(headerLocale)
		return translations, headerLocale
	} else if locales[defaultLocale] != "" {
		translations := tfuncWithFallback(defaultLocale)
		return translations, headerLocale
	}

	translations := tfuncWithFallback(defaultLocale)
	return translations, defaultLocale
}

func GetSupportedLocales() map[string]string {
	return locales
}

func tfuncWithFallback(pref string) TranslateFunc {
	t, _ := i18n.Tfunc(pref)
	return func(translationID string, args ...interface{}) string {
		if translated := t(translationID, args...); translated != translationID {
			return translated
		}

		t, _ := i18n.Tfunc(defaultLocale)
		return t(translationID, args...)
	}
}

func TranslateAsHtml(t TranslateFunc, translationID string, args map[string]interface{}) template.HTML {
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

func IdentityTfunc() TranslateFunc {
	return func(translationID string, args ...interface{}) string {
		return translationID
	}
}
