package i18n

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/pkg/errors"
	"golang.org/x/text/language"

	"github.com/mattermost/mattermost/server/public/model"
)

// PluginAPI is the plugin API interface required to manage translations.
type PluginAPI interface {
	GetBundlePath() (string, error)
	GetConfig() *model.Config
	GetUser(userID string) (*model.User, *model.AppError)
	LogWarn(msg string, keyValuePairs ...interface{})
}

// Message is a string that can be localized.
//
// See https://pkg.go.dev/github.com/nicksnyder/go-i18n/v2/i18n?tab=doc#Message for more details.
type Message = i18n.Message

// LocalizeConfig configures a call to the Localize method on Localizer.
//
// See https://pkg.go.dev/github.com/nicksnyder/go-i18n/v2/i18n?tab=doc#LocalizeConfig for more details.
type LocalizeConfig = i18n.LocalizeConfig

// Localizer provides Localize and MustLocalize methods that return localized messages.
//
// See https://pkg.go.dev/github.com/nicksnyder/go-i18n/v2/i18n?tab=doc#Localizer for more details.
type Localizer = i18n.Localizer

// Bundle stores a set of messages and pluralization rules.
// Most plugins only need a single bundle
// that is initialized on activation.
// It is not goroutine safe to modify the bundle while Localizers
// are reading from it.
type Bundle struct {
	*i18n.Bundle
	api PluginAPI
}

// InitBundle loads all localization files  from a given path into a bundle and return this.
// path is a relative path in the plugin bundle, e.g. assets/i18n.
// Every file except the ones named active.*.json.
// The default language is English.
func InitBundle(api PluginAPI, path string) (*Bundle, error) {
	bundle := &Bundle{
		Bundle: i18n.NewBundle(language.English),
		api:    api,
	}
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	bundlePath, err := api.GetBundlePath()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get bundle path")
	}

	i18nDir := filepath.Join(bundlePath, path)

	files, err := os.ReadDir(i18nDir)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open i18n directory")
	}

	for _, file := range files {
		if !strings.HasPrefix(file.Name(), "active.") {
			continue
		}

		if !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		if file.Name() == "active.en.json" {
			continue
		}

		_, err = bundle.LoadMessageFile(filepath.Join(i18nDir, file.Name()))
		if err != nil {
			return nil, errors.Wrapf(err, "failed to load message file %s", file.Name())
		}
	}

	return bundle, nil
}

// GetUserLocalizer returns a localizer that localizes in the users locale.
func (b *Bundle) GetUserLocalizer(userID string) *i18n.Localizer {
	user, err := b.api.GetUser(userID)
	if err != nil {
		b.api.LogWarn("Failed get user's locale", "error", err.Error())
		return b.GetServerLocalizer()
	}

	return i18n.NewLocalizer(b.Bundle, user.Locale)
}

// GetServerLocalizer returns a localizer that localizes in the default server locale.
//
// This is useful for situations where a messages is shown to every user,
// independent of the users locale.
func (b *Bundle) GetServerLocalizer() *i18n.Localizer {
	local := *b.api.GetConfig().LocalizationSettings.DefaultServerLocale

	return i18n.NewLocalizer(b.Bundle, local)
}

// LocalizeDefaultMessage localizer the provided message.
// An empty string is returned when the localization fails.
func (b *Bundle) LocalizeDefaultMessage(l *Localizer, m *Message) string {
	s, err := l.LocalizeMessage(m)
	if err != nil {
		b.api.LogWarn("Failed to localize message", "message ID", m.ID, "error", err.Error())
		return ""
	}

	return s
}

// LocalizeWithConfig localizer the provided localize config.
// An empty string is returned when the localization fails.
func (b *Bundle) LocalizeWithConfig(l *Localizer, lc *LocalizeConfig) string {
	s, err := l.Localize(lc)
	if err != nil {
		b.api.LogWarn("Failed to localize with config", "error", err.Error())
		return ""
	}
	return s
}
