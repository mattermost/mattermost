// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/GeertJohan/go.rice"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"

	"github.com/nicksnyder/go-i18n/i18n"
)

var T i18n.TranslateFunc
var TDefault i18n.TranslateFunc
var locales map[string]string = make(map[string]string)
var settings model.LocalizationSettings

// this functions loads translations from filesystem
// and assign english while loading server config
func TranslationsPreInit(override string) error {
	// Set T even if we fail to load the translations. Lots of shutdown handling code will
	// segfault trying to handle the error, and the untranslated IDs are strictly better.
	T = TfuncWithFallback("en")
	TDefault = TfuncWithFallback("en")

	if override == "" {
		if err := InitStaticTranslations(); err != nil {
			return err
		}
	} else {
		if err := InitTranslationsWithDir(override); err != nil {
			return err
		}
	}

	return nil
}

func InitTranslations(localizationSettings model.LocalizationSettings) error {
	settings = localizationSettings

	var err error
	T, err = GetTranslationsBySystemLocale()
	return err
}

func InitStaticTranslations() error {
	box := GetI18nBox()
	box.Walk("", func(path string, info os.FileInfo, err error) error {
		if filepath.Ext(path) == ".json" {
			locales[strings.Split(path, ".")[0]] = path

			bytes, err := box.Bytes(path)
			if err != nil {
				return err
			}

			if err := i18n.ParseTranslationFileBytes(path, bytes); err != nil {
				return err
			}
		}
		return nil
	})

	return nil
}

func InitTranslationsWithDir(dir string) error {
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

func GetTranslationsBySystemLocale() (i18n.TranslateFunc, error) {
	locale := *settings.DefaultServerLocale
	if _, ok := locales[locale]; !ok {
		mlog.Error(fmt.Sprintf("Failed to load system translations for '%v' attempting to fall back to '%v'", locale, model.DEFAULT_LOCALE))
		locale = model.DEFAULT_LOCALE
	}

	if locales[locale] == "" {
		return nil, fmt.Errorf("Failed to load system translations for '%v'", model.DEFAULT_LOCALE)
	}

	translations := TfuncWithFallback(locale)
	if translations == nil {
		return nil, fmt.Errorf("Failed to load system translations")
	}

	mlog.Info(fmt.Sprintf("Loaded system translations for '%v' from '%v'", locale, locales[locale]))
	return translations, nil
}

func GetUserTranslations(locale string) i18n.TranslateFunc {
	if _, ok := locales[locale]; !ok {
		locale = model.DEFAULT_LOCALE
	}

	translations := TfuncWithFallback(locale)
	return translations
}

func GetTranslationsAndLocale(w http.ResponseWriter, r *http.Request) (i18n.TranslateFunc, string) {
	// This is for checking against locales like pt_BR or zn_CN
	headerLocaleFull := strings.Split(r.Header.Get("Accept-Language"), ",")[0]
	// This is for checking against locales like en, es
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

func GetSupportedLocales() map[string]string {
	return locales
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

func GetI18nBox() *rice.Box {
	return rice.MustFindBox("../i18n")
}
