package utils

import (
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/nicksnyder/go-i18n/i18n"
)

var T i18n.TranslateFunc
var locales map[string]string = make(map[string]string)
var settings model.LocalizationSettings

// this functions loads translations from filesystem
// and assign english while loading server config
func TranslationsPreInit() {
	InitTranslationsWithDir("i18n")
	T = TfuncWithFallback("en")
}

func InitTranslations(localizationSettings model.LocalizationSettings) {
	settings = localizationSettings
	T = GetTranslationsBySystemLocale()
}

func InitTranslationsWithDir(dir string) {
	i18nDirectory := FindDir(dir)
	files, _ := ioutil.ReadDir(i18nDirectory)
	for _, f := range files {
		if filepath.Ext(f.Name()) == ".json" {
			filename := f.Name()
			locales[strings.Split(filename, ".")[0]] = i18nDirectory + filename
			i18n.MustLoadTranslationFile(i18nDirectory + filename)
		}
	}
}

func GetTranslationsBySystemLocale() i18n.TranslateFunc {
	locale := *settings.DefaultServerLocale
	if _, ok := locales[locale]; !ok {
		l4g.Error("Failed to load system translations for '%v' attempting to fall back to '%v'", locale, model.DEFAULT_LOCALE)
		locale = model.DEFAULT_LOCALE
	}

	if locales[locale] == "" {
		panic("Failed to load system translations for '" + model.DEFAULT_LOCALE + "'")
	}

	translations := TfuncWithFallback(locale)
	if translations == nil {
		panic("Failed to load system translations")
	}

	l4g.Info(translations("utils.i18n.loaded"), locale, locales[locale])
	return translations
}

func GetUserTranslations(locale string) i18n.TranslateFunc {
	if _, ok := locales[locale]; !ok {
		locale = model.DEFAULT_LOCALE
	}

	translations := TfuncWithFallback(locale)
	return translations
}

func SetTranslations(locale string) i18n.TranslateFunc {
	translations := TfuncWithFallback(locale)
	return translations
}

func GetTranslationsAndLocale(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
	// This is for checking against locales like pt_BR or zn_CN
	headerLocaleFull := strings.Split(r.Header.Get("Accept-Language"), ",")[0]
	// This is for checking agains locales like en, es
	headerLocale := strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	defaultLocale := *settings.DefaultClientLocale
	if locales[headerLocaleFull] != "" {
		translations := TfuncWithFallback(headerLocaleFull)
		return translations, headerLocaleFull
	} else if locales[headerLocale] != "" {
		translations := TfuncWithFallback(headerLocale)
		return translations, headerLocale
	} else if locales[defaultLocale] != "" {
		translations := TfuncWithFallback(defaultLocale)
		return translations, headerLocale
	}

	translations := TfuncWithFallback(model.DEFAULT_LOCALE)
	return translations, model.DEFAULT_LOCALE
}

func TfuncWithFallback(pref string) i18n.TranslateFunc {
	t, _ := i18n.Tfunc(pref)
	return func(translationID string, args ...interface{}) string {
		if translated := t(translationID, args...); translated != translationID {
			return translated
		}

		t, _ := i18n.Tfunc(model.DEFAULT_LOCALE)
		return t(translationID, args...)
	}
}
