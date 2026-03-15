---
title: "Localizing Matterpoll"
heading: "Localizing Matterpoll"
description: "Matterpoll is a plugin that allows users to create polls in Mattermost. Learn about how we localized it."
slug: localizing-matterpoll
date: 2019-12-11T10:49:35+02:00
categories:
    - "plugins"
    - "go"
author: Ben Schumacher
github: hanzei
community: hanzei
---

[Matterpoll](https://github.com/matterpoll/matterpoll) is a plugin that allows users to create polls in Mattermost. Since Mattermost is [localized in 16 different languages](https://docs.mattermost.com/developer/localization.html), it’s optimal that Matterpoll is similarly localized.

Because we rely on contributors to do the translations, we want to make it easy for them to translate new strings and determine whether already translated strings need to be updated because the "source" text changed. On the other hand, Matterpoll only has two maintainers ([@kaakaa](https://github.com/kaakaa) and [me](https://github.com/hanzei)) and no infrastructure of its own to work with. Using a translation server like [Transifex](https://en.wikipedia.org/wiki/Transifex) or [Weblate](https://en.wikipedia.org/wiki/Weblate) is not an option.

The [Mattermost Server](https://github.com/mattermost/mattermost) uses the [go-i18n package](https://github.com/nicksnyder/go-i18n). The library is well maintained and very popular, which makes it an attractive tool for this purpose.

This blog provides an outline for developers of how plugins can use the existing framework to support localization.


#### Choosing a Version

When [Translations where added to Mattermost](https://github.com/mattermost/mattermost/commit/8e404c1dcf820cf767e9d6899e8c1efc7bb5ca96#diff-db85c0ea4d2e69c8abaefa875ba77c51) in 2016, the latest version of go-i18n available was [`v1.4.0`](https://github.com/nicksnyder/go-i18n/releases/tag/v1.4.0). In May of this year [`v2.0.0`](https://github.com/nicksnyder/go-i18n/releases/tag/v2.0.0) was released and has a completely different API. The CLI tool [`goi18n`](https://github.com/nicksnyder/go-i18n#command-goi18n-) has also changed significantly. Hence, we had to decide whether to stick with the proven v1 or use the newer v2. 

Let's examine the difference between the two versions. In v1, translation strings are defined in the translation files; for example, `en-US.all.json` would contain:
```json
  {
    "id": "settings_title",
    "translation": "Settings"
  }
```
These translations would then be accessible in the Go code with a translation function (`T("settings_title")`). This leads to a loose coupling between the translations string in the translation file and in the code. Unfortunately developers tend to forget to add a translation string, or they misspell the ID.

V2 fixed this by defining the translations string in the code and automatically extracting it into the translation file. This greatly improves the developer experience. In addition, there are now **two** translation files for every language. For example, German has `active.de.json`, which contains already translated strings, and `translate.de.json`, which contains strings that have to be translated. They are either newly-added strings or strings where the text changed. `goi18n` helps with auto-populating these files.

This change is very handy for both developers and contributors and the main reason we ended up choosing v2 for Matterpoll. Other notable changes are:

- Better support for plural forms with options for e.g., `Zero`, `One`, `Few` and `Many`.
- No global state, which helps with running tests in parallel.
- Use of [`golang.org/x/text/language`](https://godoc.org/golang.org/x/text/language) for standardized behavior.

For further information refer to [Changelog](https://github.com/nicksnyder/go-i18n/blob/master/CHANGELOG.md#v2) of go-i18n.

Also, it's a good idea to stay up to date with the major version of the libraries that you are using. This ensures you get the latest bug fixes because open libraries don't backport fixes.

These improvements are why we decided to go with v2 of go-i18n.


#### Choosing a File Format

Go-i18n supports multiple file formats for the translation file. In fact, you can use any file format as long as you implement an [unmarshal function](https://godoc.org/github.com/nicksnyder/go-i18n/v2/i18n#UnmarshalFunc) yourself. The most common formats are `JSON`, `TOML` and, `YAML`.

What is the preferred format for us? `goi18n` uses `TOML` by default, but since the Mattermost server uses `JSON` we decided to stay with that format. We could just as easily have stuck with the default format `TOML` of `goi18n` for consistency with the library default with no adverse effect.


### Integrating go-i18n into Matterpoll

With these decisions made we started working on integrating go-i18n into Matterpoll. But first we have to introduce three concepts that go-i18n uses (technically speaking they are just structs):

- [`Bundle`](https://godoc.org/github.com/nicksnyder/go-i18n/v2/i18n#Bundle): A `Bundle` contains the translations.
- [`Message`](https://godoc.org/github.com/nicksnyder/go-i18n/v2/i18n#Message): A `Message` is a translation string and can contain plural rules.
- [`Localizer`](https://godoc.org/github.com/nicksnyder/go-i18n/v2/i18n#Localizer): A `Localizer` translates `Messages` to a specific language using a `Bundle`.

Because Matterpoll needs to fetch the translation files on startup, they need to be included in the plugin bundle. The makefile of the plugin starter template allows plugin developers to simply place their file into `assets` [to get them included in the bundle](https://github.com/mattermost/mattermost-plugin-starter-template#how-do-i-include-assets-in-the-plugin-bundle). 

Beginning with Mattermost v5.10, there is also a [`GetBundlePath()`](https://developers.mattermost.com/integrate/plugins/server/reference/#API.GetBundlePath) method in the plugin API that returns the absolute path where the plugin's bundle was unpacked. This makes accessing assets much easier. The code to load the translation [looks like this](https://github.com/matterpoll/matterpoll/pull/133/files#diff-700816f9b4d51d7404d71e90d2661ddcR15-R45):
```go
// initBundle loads all localization files in i18n into a bundle and return this
func (p *MatterpollPlugin) initBundle() (*i18n.Bundle, error) {
	bundle := &i18n.Bundle{DefaultLanguage: language.English}
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	bundlePath, err := p.API.GetBundlePath()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get bundle path")
	}

	i18nDir := filepath.Join(bundlePath, "assets", "i18n")
	files, err := ioutil.ReadDir(i18nDir)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open i18n directory")
	}

	for _, file := range files {
		if !strings.HasPrefix(file.Name(), "active.") {
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
```

The bundle returned is stored inside the `MatterpollPlugin` struct. We call `initBundle` once in [`OnActivate`](https://developers.mattermost.com/integrate/plugins/server/reference/#Hooks.OnActivate).

A `Localizer` is ephemeral and needs to be created every time a user interacts with the plugin, for example, when creating a poll via `/poll` or voting by pressing an [Interactive Message Button](https://docs.mattermost.com/developer/interactive-messages.html). In order to create a `Localizer`  we need to fetch the user's `Locale` setting. Conveniently, it's part of the [`User`](https://godoc.org/github.com/mattermost/mattermost-server/model#User) struct. We wrote a short helper function to create a `Localizer` for a specific user:

```go
// getUserLocalizer returns a localizer that localizes in the users locale
func (p *MatterpollPlugin) getUserLocalizer(userID string) *i18n.Localizer {
	user, err := p.API.GetUser(userID)
	if err != nil {
		p.API.LogWarn("Failed get user's locale", "error", err.Error())
		return p.getServerLocalizer()
	}

	return i18n.NewLocalizer(p.bundle, user.Locale)
}
```

Not every part of Matterpoll is localizable on a user level. Take polls for example.

{{< figure src="poll-1.png" alt="Poll 1">}}

While the response when clicking an option should be localized with the user's locale, the "Total Votes" text cannot. Posts are shown in the same way for every user, hence we have to use the same localization for every user. Admins can configure a [Default Client Language](https://docs.mattermost.com/administration/config-settings.html#default-client-language) in the System Console that is used for newly-created users and pages where the user hasn’t logged in. We decided to use this locale for translating these kind of strings and build a helper for this:

```go
// getServerLocalizer returns a localizer that localizes in the server default client locale
func (p *MatterpollPlugin) getServerLocalizer() *i18n.Localizer {
	return i18n.NewLocalizer(p.bundle, *p.ServerConfig.LocalizationSettings.DefaultClientLocale)
}
```

With this preparation we were finally ready to do the actual task: defining and translating actual strings. Putting the pieces together is quite simple and comes down to:

```go
	l := p.getUserLocalizer(userID)
	response, err := l.LocalizeMessage(&i18n.Message{
		ID:    "response.vote.counted",
		Other: "Your vote has been counted.",
	}
	
	// Send response back
```

Most but not all translation strings can be translated without any context information: for example, the "Total Votes" text you saw above include the number of votes. We did incorporate this information directly into the `Message`:

```go
	l := p.getUserLocalizer(userID)
	response, err := l.Localize(&i18n.LocalizeConfig{
		DefaultMessage: &i18n.Message{
			ID:    "poll.message.totalVotes",
			Other: "**Total votes**: {{.TotalVotes}}",
		},
		TemplateData:   map[string]interface{}{"TotalVotes": numberOfVotes},
	})
		
	// Send response back
```

### Extracting the Translation Strings

As already mentioned [`goi18n`](https://github.com/nicksnyder/go-i18n#command-goi18n-), allows the extraction of the translation string from the code into the translation file. This can be done by running
`goi18n extract -format json -outdir assets/i18n/ server/`, which creates `assets/i18n/active.en.json` containing all translation strings.

#### Adding a New Language

If, for example, we want to add support for German, which has the language code `de`, we have to:

1. Create its own file: `touch assets/i18n/translate.de.json`
- Merge all translation strings into the new file: `goi18n merge -format json -outdir assets/i18n/ assets/i18n/active.en.json assets/i18n/translate.de.json`
- Translate all strings in `translate.de.json`
- Rename it from `translate.de.json` to `active.de.json`

#### Translating New Strings

1. Extract the new goi18n translations strings: `goi18n extract -format json -outdir assets/i18n/ server/`
- Update your translation file: `goi18n merge -format json -outdir assets/i18n/ assets/i18n/active.*.json`
- Translate all strings for a language, for example, in `active.de.json`
- Merge the translations in the active files: `goi18n merge -format json -outdir assets/i18n/ assets/i18n/active.*.json assets/i18n/translate.de.json`

### Future Ideas

This is a rough outline of how plugins can use the existing framework to fully support localization. If other plugin developers adapt this approach, it might get officially supported by Mattermost. This means that the plugin framework would support translations via go-i18n.

- As you can see, using `goi18n` is a bit cumbersome. To make translating easier some commands could be encapsulated in make target in the [starter-template](https://github.com/mattermost/mattermost-plugin-starter-template/blob/master/Makefile).
- The helper methods like `initBundle`, `getUserLocalizer` and `getServerLocalizer` could become a [plugin helper]({{< ref "/integrate/plugins/helpers" >}}).

I would love to hear feedback about the approach we took. Feel free to share it on the [Toolkit channel](https://community.mattermost.com/core/channels/developer-toolkit) on the Mattermost community server.
