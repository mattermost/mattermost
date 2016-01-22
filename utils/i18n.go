package utils

import (
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/cloudfoundry/jibber_jabber"
	"github.com/mattermost/platform/model"
	"github.com/nicksnyder/go-i18n/i18n"
)

var T i18n.TranslateFunc
var locales map[string]string = make(map[string]string)

func InitTranslations() {
	i18nDirectory := FindDir("i18n")
	files, _ := ioutil.ReadDir(i18nDirectory)
	for _, f := range files {
		if filepath.Ext(f.Name()) == ".json" {
			filename := f.Name()
			locales[strings.Split(filename, ".")[0]] = i18nDirectory + filename
			i18n.MustLoadTranslationFile(i18nDirectory + filename)
		}
	}

	T = GetTranslationsBySystemLocale()
}

func GetTranslationsBySystemLocale() i18n.TranslateFunc {
	locale := model.DEFAULT_LOCALE
	if userLanguage, err := jibber_jabber.DetectLanguage(); err == nil {
		if _, ok := locales[userLanguage]; ok {
			locale = userLanguage
		} else {
			l4g.Error("Failed to load system translations for '%v' attempting to fall back to '%v'", locale, model.DEFAULT_LOCALE)
			locale = model.DEFAULT_LOCALE
		}
	}

	if locales[locale] == "" {
		panic("Failed to load system translations for '" + model.DEFAULT_LOCALE + "'")
	}

	translations, _ := i18n.Tfunc(locale)
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

	translations, _ := i18n.Tfunc(locale)
	return translations
}

func SetTranslations(locale string) i18n.TranslateFunc {
	translations, _ := i18n.Tfunc(locale)
	return translations
}

func GetTranslationsAndLocale(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
	headerLocale := strings.Split(strings.Split(r.Header.Get("Accept-Language"), ",")[0], "-")[0]
	if locales[headerLocale] != "" {
		translations, _ := i18n.Tfunc(headerLocale)
		return translations, headerLocale
	}

	translations, _ := i18n.Tfunc(model.DEFAULT_LOCALE)
	return translations, model.DEFAULT_LOCALE
}
