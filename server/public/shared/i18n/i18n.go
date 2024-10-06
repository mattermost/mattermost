// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package i18n

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost/server/public/shared/mlog"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

const defaultLocale = "en"

// TranslateFunc is the type of the translate functions
type TranslateFunc func(translationID string, args ...any) string

// TranslationFuncByLocal is the type of function that takes local as a string and returns the translation function
type TranslationFuncByLocal func(locale string) TranslateFunc

// T is the translate function using the default server language as fallback language
var T TranslateFunc

var bundle *i18n.Bundle

// supportedLocales is a hard-coded list of locales considered ready for production use. It must
// be kept in sync with ../../../../webapp/channels/src/i18n/i18n.jsx.
var supportedLocales = []string{
	"de",
	"en",
	"en-AU",
	"es",
	"fr",
	"it",
	"hu",
	"nl",
	"pl",
	"pt-BR",
	"ro",
	"sv",
	"vi",
	"tr",
	"bg",
	"ru",
	"uk",
	"fa",
	"ko",
	"zh-CN",
	"zh-TW",
	"ja",
}
var defaultServerLocale string
var defaultClientLocale string

func newBundle() *i18n.Bundle {
	b := i18n.NewBundle(language.MustParse(defaultLocale))
	b.RegisterUnmarshalFunc("json", json.Unmarshal)
	return b
}

// TranslationsPreInit loads translations from filesystem if they are not
// loaded already and assigns english while loading server config
func TranslationsPreInit(translationsDir string) error {
	if T != nil {
		return nil
	}

	bundle = newBundle()

	// Set T even if we fail to load the translations. Lots of shutdown handling code will
	// segfault trying to handle the error, and the untranslated IDs are strictly better.
	T = tfuncWithFallback(defaultLocale)

	return initTranslationsWithDir(bundle, translationsDir)
}

// InitTranslations set the defaults configured in the server and initialize
// the T function using the server default as fallback language
func InitTranslations(serverLocale, clientLocale string) error {
	defaultServerLocale = serverLocale
	defaultClientLocale = clientLocale

	var err error
	T, err = GetTranslationsBySystemLocale()
	return err
}

func initTranslationsWithDir(bundle *i18n.Bundle, dir string) error {
	files, _ := os.ReadDir(dir)
	for _, f := range files {
		if filepath.Ext(f.Name()) == ".json" {
			filename := f.Name()

			locale := strings.Split(filename, ".")[0]
			if !isSupportedLocale(locale) {
				continue
			}

			if _, err := bundle.LoadMessageFile(filepath.Join(dir, filename)); err != nil {
				return err
			}
		}
	}

	return nil
}

// GetTranslationFuncForDir loads translations from the filesystem into a new instance of the bundle.
// It returns a function to access loaded translations.
func GetTranslationFuncForDir(dir string) (TranslationFuncByLocal, error) {
	b := newBundle()

	if err := initTranslationsWithDir(b, dir); err != nil {
		return nil, err
	}

	return func(locale string) TranslateFunc {
		localizer := i18n.NewLocalizer(b, locale)
		return tfuncFromLocalizer(localizer)
	}, nil
}

func GetTranslationsBySystemLocale() (TranslateFunc, error) {
	locales := GetSupportedLocales()
	locale := defaultServerLocale
	if _, ok := locales[locale]; !ok {
		mlog.Warn("Failed to load system translations for selected locale, attempting to fall back to default", mlog.String("locale", locale), mlog.String("default_locale", defaultLocale))
		locale = defaultLocale
	}

	if !isSupportedLocale(locale) {
		mlog.Warn("Selected locale is unsupported, attempting to fall back to default", mlog.String("locale", locale), mlog.String("default_locale", defaultLocale))
		locale = defaultLocale
	}

	if _, ok := locales[locale]; !ok {
		return nil, fmt.Errorf("failed to load system translations for '%v'", locale)
	}

	translations := tfuncWithFallback(locale)
	if translations == nil {
		return nil, fmt.Errorf("failed to load system translations")
	}

	mlog.Info("Loaded system translations", mlog.String("for locale", locale))
	return translations, nil
}

// GetUserTranslations get the translation function for an specific locale
func GetUserTranslations(locale string) TranslateFunc {
	return tfuncWithFallback(locale)
}

// GetTranslationsAndLocaleFromRequest return the translation function and the
// locale based on a request headers
func GetTranslationsAndLocaleFromRequest(r *http.Request) (TranslateFunc, string) {
	locales := GetSupportedLocales()
	// This is for checking against locales like pt_BR or zn_CN
	headerLocaleFull := strings.Split(r.Header.Get("Accept-Language"), ",")[0]
	// This is for checking against locales like en, es
	headerLocale := strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	defaultLocale := defaultClientLocale
	if _, ok := locales[headerLocaleFull]; ok {
		translations := tfuncWithFallback(headerLocaleFull)
		return translations, headerLocaleFull
	} else if _, ok := locales[headerLocale]; ok {
		translations := tfuncWithFallback(headerLocale)
		return translations, headerLocale
	}

	translations := tfuncWithFallback(defaultLocale)
	return translations, defaultLocale
}

// GetSupportedLocales return a map of locale code and the file path with the
// translations
func GetSupportedLocales() map[string]bool {
	locales := make(map[string]bool)
	if bundle != nil {
		for _, locale := range bundle.LanguageTags() {
			locales[locale.String()] = true
		}
	}
	return locales
}

func tfuncFromLocalizer(localizer *i18n.Localizer) TranslateFunc {
	return func(translationID string, args ...interface{}) string {
		var templateData interface{}
		var pluralCount interface{}

		if argc := len(args); argc > 0 {
			switch args[0].(type) {
			case int, int8, int16, int32, int64, string:
				pluralCount = args[0]
				if argc > 1 {
					templateData = args[1]
				}
			default:
				templateData = args[0]
			}
		}

		if translated, err := localizer.Localize(&i18n.LocalizeConfig{
			MessageID:    translationID,
			TemplateData: templateData,
			PluralCount:  pluralCount,
		}); err == nil {
			return translated
		}

		return translationID
	}
}

func tfuncWithFallback(pref string) TranslateFunc {
	localizer := i18n.NewLocalizer(bundle, pref)
	return tfuncFromLocalizer(localizer)
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

func isSupportedLocale(locale string) bool {
	for _, supportedLocale := range supportedLocales {
		if locale == supportedLocale {
			return true
		}
	}

	return false
}
