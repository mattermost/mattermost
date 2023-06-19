// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package i18n

import (
	"fmt"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/go-i18n/i18n/bundle"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const defaultLocale = "en"

// TranslateFunc is the type of the translate functions
type TranslateFunc func(translationID string, args ...any) string

// TranslationFuncByLocal is the type of function that takes local as a string and returns the translation function
type TranslationFuncByLocal func(locale string) TranslateFunc

// T is the translate function using the default server language as fallback language
var T TranslateFunc

// TDefault is the translate function using english as fallback language
var TDefault TranslateFunc

var locales = make(map[string]string)
var defaultServerLocale string
var defaultClientLocale string

// TranslationsPreInit loads translations from filesystem if they are not
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

// InitTranslations set the defaults configured in the server and initialize
// the T function using the server default as fallback language
func InitTranslations(serverLocale, clientLocale string) error {
	defaultServerLocale = serverLocale
	defaultClientLocale = clientLocale

	var err error
	T, err = getTranslationsBySystemLocale()
	return err
}

func initTranslationsWithDir(dir string) error {
	files, _ := os.ReadDir(dir)
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

// GetTranslationFuncForDir loads translations from the filesystem into a new instance of the bundle.
// It returns a function to access loaded translations.
func GetTranslationFuncForDir(dir string) (TranslationFuncByLocal, error) {
	var availableLocals = make(map[string]string)
	bundle := bundle.New()
	files, _ := os.ReadDir(dir)
	for _, f := range files {
		if filepath.Ext(f.Name()) != ".json" {
			continue
		}

		filename := f.Name()
		availableLocals[strings.Split(filename, ".")[0]] = filepath.Join(dir, filename)
		if err := bundle.LoadTranslationFile(filepath.Join(dir, filename)); err != nil {
			return nil, err
		}
	}

	return func(locale string) TranslateFunc {
		if _, ok := availableLocals[locale]; !ok {
			locale = defaultLocale
		}

		t, _ := bundle.Tfunc(locale)
		return func(translationID string, args ...any) string {
			if translated := t(translationID, args...); translated != translationID {
				return translated
			}

			t, _ := bundle.Tfunc(defaultLocale)
			return t(translationID, args...)
		}
	}, nil
}

func getTranslationsBySystemLocale() (TranslateFunc, error) {
	locale := defaultServerLocale
	if _, ok := locales[locale]; !ok {
		mlog.Warn("Failed to load system translations for", mlog.String("locale", locale), mlog.String("attempting to fall back to default locale", defaultLocale))
		locale = defaultLocale
	}

	if locales[locale] == "" {
		return nil, fmt.Errorf("failed to load system translations for '%v'", defaultLocale)
	}

	translations := tfuncWithFallback(locale)
	if translations == nil {
		return nil, fmt.Errorf("failed to load system translations")
	}

	mlog.Info("Loaded system translations", mlog.String("for locale", locale), mlog.String("from locale", locales[locale]))
	return translations, nil
}

// GetUserTranslations get the translation function for an specific locale
func GetUserTranslations(locale string) TranslateFunc {
	if _, ok := locales[locale]; !ok {
		locale = defaultLocale
	}

	translations := tfuncWithFallback(locale)
	return translations
}

// GetTranslationsAndLocaleFromRequest return the translation function and the
// locale based on a request headers
func GetTranslationsAndLocaleFromRequest(r *http.Request) (TranslateFunc, string) {
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

// GetSupportedLocales return a map of locale code and the file path with the
// translations
func GetSupportedLocales() map[string]string {
	return locales
}

func tfuncWithFallback(pref string) TranslateFunc {
	t, _ := i18n.Tfunc(pref)
	return func(translationID string, args ...any) string {
		if translated := t(translationID, args...); translated != translationID {
			return translated
		}

		t, _ := i18n.Tfunc(defaultLocale)
		return t(translationID, args...)
	}
}

// TranslateAsHTML translates the translationID provided and return a
// template.HTML object
func TranslateAsHTML(t TranslateFunc, translationID string, args map[string]any) template.HTML {
	message := t(translationID, escapeForHTML(args))
	message = strings.Replace(message, "[[", "<strong>", -1)
	message = strings.Replace(message, "]]", "</strong>", -1)
	return template.HTML(message)
}

func escapeForHTML(arg any) any {
	switch typedArg := arg.(type) {
	case string:
		return template.HTMLEscapeString(typedArg)
	case *string:
		return template.HTMLEscapeString(*typedArg)
	case map[string]any:
		safeArg := make(map[string]any, len(typedArg))
		for key, value := range typedArg {
			safeArg[key] = escapeForHTML(value)
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

// IdentityTfunc returns a translation function that don't translate, only
// returns the same id
func IdentityTfunc() TranslateFunc {
	return func(translationID string, args ...any) string {
		return translationID
	}
}
