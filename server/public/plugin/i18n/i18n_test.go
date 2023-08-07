package i18n_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/language"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/i18n"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
)

//nolint:govet
func ExampleInitBundle() {
	type Plugin struct {
		plugin.MattermostPlugin

		b *i18n.Bundle
	}

	p := Plugin{}
	b, err := i18n.InitBundle(p.API, filepath.Join("assets", "i18n"))
	if err != nil {
		panic(err)
	}

	p.b = b
}

func TestInitBundle(t *testing.T) {
	t.Run("fine", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		defer os.RemoveAll(dir)

		// Create assets/i18n dir
		i18nDir := filepath.Join(dir, "assets", "i18n")
		err = os.MkdirAll(i18nDir, 0o700)
		require.NoError(t, err)

		file := filepath.Join(i18nDir, "active.de.json")
		content := []byte("{}")
		err = os.WriteFile(file, content, 0o600)
		require.NoError(t, err)

		// Add en translation file.
		// InitBundle should ignore it.
		file = filepath.Join(i18nDir, "active.en.json")
		content = []byte("")
		err = os.WriteFile(file, content, 0o600)
		require.NoError(t, err)

		// Add json junk file
		file = filepath.Join(i18nDir, "foo.json")
		content = []byte("")
		err = os.WriteFile(file, content, 0o600)
		require.NoError(t, err)

		// Add active. junk file
		file = filepath.Join(i18nDir, "active.foo")
		content = []byte("")
		err = os.WriteFile(file, content, 0o600)
		require.NoError(t, err)

		api := &plugintest.API{}
		api.On("GetBundlePath").Return(dir, nil)
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, "assets/i18n")
		assert.NoError(t, err)
		assert.NotNil(t, b)

		assert.ElementsMatch(t, []language.Tag{language.English, language.German}, b.LanguageTags())
	})

	t.Run("fine", func(t *testing.T) {
		dir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		defer os.RemoveAll(dir)

		// Create assets/i18n dir
		i18nDir := filepath.Join(dir, "assets", "i18n")
		err = os.MkdirAll(i18nDir, 0o700)
		require.NoError(t, err)

		file := filepath.Join(i18nDir, "active.de.json")
		content := []byte("{}")
		err = os.WriteFile(file, content, 0o600)
		require.NoError(t, err)

		// Add translation file with invalid content
		file = filepath.Join(i18nDir, "active.es.json")
		content = []byte("foo bar")
		err = os.WriteFile(file, content, 0o600)
		require.NoError(t, err)

		api := &plugintest.API{}
		api.On("GetBundlePath").Return(dir, nil)
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, "assets/i18n")
		assert.Error(t, err)
		assert.Nil(t, b)
	})
}

func TestLocalizeDefaultMessage(t *testing.T) {
	t.Run("fine", func(t *testing.T) {
		api := &plugintest.API{}
		defaultServerLocale := "en"
		api.On("GetConfig").Return(&model.Config{
			LocalizationSettings: model.LocalizationSettings{
				DefaultServerLocale: &defaultServerLocale,
			},
		})
		api.On("GetBundlePath").Return(".", nil)
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, ".")
		require.NoError(t, err)

		l := b.GetServerLocalizer()
		m := &i18n.Message{
			Other: "test message",
		}

		assert.Equal(t, m.Other, b.LocalizeDefaultMessage(l, m))
	})

	t.Run("empty message", func(t *testing.T) {
		api := &plugintest.API{}
		defaultServerLocale := "en"
		api.On("GetConfig").Return(&model.Config{
			LocalizationSettings: model.LocalizationSettings{
				DefaultServerLocale: &defaultServerLocale,
			},
		})
		api.On("GetBundlePath").Return(".", nil)
		api.On("LogWarn", mock.AnythingOfType("string"),
			mock.AnythingOfType("string"), mock.AnythingOfType("string"),
			mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return()
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, ".")
		require.NoError(t, err)

		l := b.GetServerLocalizer()
		m := &i18n.Message{}

		assert.Equal(t, "", b.LocalizeDefaultMessage(l, m))
	})
}

func TestLocalizeWithConfig(t *testing.T) {
	t.Run("fine", func(t *testing.T) {
		api := &plugintest.API{}
		defaultServerLocale := "en"
		api.On("GetConfig").Return(&model.Config{
			LocalizationSettings: model.LocalizationSettings{
				DefaultServerLocale: &defaultServerLocale,
			},
		})
		api.On("GetBundlePath").Return(".", nil)
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, ".")
		require.NoError(t, err)

		l := b.GetServerLocalizer()
		lc := &i18n.LocalizeConfig{
			DefaultMessage: &i18n.Message{
				Other: "test messsage",
			},
		}

		assert.Equal(t, lc.DefaultMessage.Other, b.LocalizeWithConfig(l, lc))
	})

	t.Run("empty config", func(t *testing.T) {
		api := &plugintest.API{}
		defaultServerLocale := "en"
		api.On("GetConfig").Return(&model.Config{
			LocalizationSettings: model.LocalizationSettings{
				DefaultServerLocale: &defaultServerLocale,
			},
		})
		api.On("GetBundlePath").Return(".", nil)
		api.On("LogWarn", mock.AnythingOfType("string"),
			mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return()
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, ".")
		require.NoError(t, err)

		l := b.GetServerLocalizer()
		lc := &i18n.LocalizeConfig{}

		assert.Equal(t, "", b.LocalizeWithConfig(l, lc))
	})

	t.Run("empty message", func(t *testing.T) {
		api := &plugintest.API{}
		defaultServerLocale := "en"
		api.On("GetConfig").Return(&model.Config{
			LocalizationSettings: model.LocalizationSettings{
				DefaultServerLocale: &defaultServerLocale,
			},
		})
		api.On("GetBundlePath").Return(".", nil)
		api.On("LogWarn", mock.AnythingOfType("string"),
			mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return()
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, ".")
		require.NoError(t, err)

		l := b.GetServerLocalizer()
		lc := &i18n.LocalizeConfig{
			DefaultMessage: &i18n.Message{},
		}

		assert.Equal(t, "", b.LocalizeWithConfig(l, lc))
	})
}
func TestGetUserLocalizer(t *testing.T) {
	t.Run("fine", func(t *testing.T) {
		api := &plugintest.API{}
		api.On("GetUser", "userID").Return(&model.User{
			Locale: "de",
		}, nil)
		api.On("GetBundlePath").Return(".", nil)
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, ".")
		require.NoError(t, err)

		l := b.GetUserLocalizer("userID")
		assert.NotNil(t, l)

		enMessage := &i18n.Message{
			Other: "a",
		}

		deMessage := &i18n.Message{
			Other: "b",
		}

		err = b.Bundle.AddMessages(language.German, deMessage)
		require.NoError(t, err)

		assert.Equal(t, deMessage.Other, b.LocalizeDefaultMessage(l, enMessage))
	})

	t.Run("error", func(t *testing.T) {
		api := &plugintest.API{}
		defaultServerLocale := "es"
		api.On("GetConfig").Return(&model.Config{
			LocalizationSettings: model.LocalizationSettings{
				DefaultServerLocale: &defaultServerLocale,
			},
		})
		api.On("GetBundlePath").Return(".", nil)
		api.On("GetUser", "userID").Return(nil, &model.AppError{})
		api.On("LogWarn", mock.AnythingOfType("string"),
			mock.AnythingOfType("string"), mock.AnythingOfType("string"),
			mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return()
		defer api.AssertExpectations(t)

		b, err := i18n.InitBundle(api, ".")
		require.NoError(t, err)

		l := b.GetUserLocalizer("userID")
		assert.NotNil(t, l)

		enMessage := &i18n.Message{
			Other: "a",
		}

		esMessage := &i18n.Message{
			Other: "b",
		}

		err = b.Bundle.AddMessages(language.Spanish, esMessage)
		require.NoError(t, err)

		assert.Equal(t, esMessage.Other, b.LocalizeDefaultMessage(l, enMessage))
	})
}
