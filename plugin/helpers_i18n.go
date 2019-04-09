// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"io/ioutil"
	"path/filepath"
	"strings"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/model"
)

func (p *HelpersImpl) TServer(translationID string, args ...interface{}) string {
	if p.localizationSettings == nil {
		return translationID
	}

	if p.locales[*p.localizationSettings.DefaultClientLocale] != "" {
		return TfuncWithFallback(*p.localizationSettings.DefaultClientLocale)(translationID, args...)
	}

	return TfuncWithFallback(model.DEFAULT_LOCALE)(translationID, args...)
}

func (p *HelpersImpl) TContext(c *Context, translationID string, args ...interface{}) string {
	if p.localizationSettings == nil {
		return translationID
	}

	// This is for checking against locales like pt_BR or zn_CN
	headerLocaleFull := strings.Split(c.AcceptLanguage, ",")[0]

	// This is for checking against locales like en, es
	headerLocale := strings.Split(strings.Split(c.AcceptLanguage, ",")[0], "-")[0]

	// Fallback locale
	defaultLocale := *p.localizationSettings.DefaultClientLocale

	if p.locales[headerLocaleFull] != "" {
		return TfuncWithFallback(headerLocaleFull)(translationID, args...)
	} else if p.locales[headerLocale] != "" {
		return TfuncWithFallback(headerLocale)(translationID, args...)
	} else if p.locales[defaultLocale] != "" {
		return TfuncWithFallback(defaultLocale)(translationID, args...)
	}

	return TfuncWithFallback(model.DEFAULT_LOCALE)(translationID, args...)
}

// Default implmentation for SetLocalization. Plugin is free to override, but this should not be nessisary.
func (p *HelpersImpl) SetLocalization(settings *model.LocalizationSettings, i18nDirectory string) error {
	p.localizationSettings = settings
	p.locales = map[string]string{}

	files, _ := ioutil.ReadDir(i18nDirectory)
	for _, f := range files {
		if filepath.Ext(f.Name()) == ".json" {
			filename := f.Name()
			p.API.LogDebug("Loading translation file", "filename", filename)
			p.locales[strings.Split(filename, ".")[0]] = filepath.Join(i18nDirectory, filename)

			if err := i18n.LoadTranslationFile(filepath.Join(i18nDirectory, filename)); err != nil {
				return err
			}
		}
	}

	return nil
}

func TfuncWithFallback(pref string) i18n.TranslateFunc {
	t, _ := i18n.Tfunc(pref)
	return func(translationID string, args ...interface{}) string {
		if translated := t(translationID, args...); translated != translationID {
			return translated
		}

		t, _ := i18n.Tfunc("en")
		return t(translationID, args...)
	}
}
