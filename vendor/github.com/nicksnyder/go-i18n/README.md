go-i18n [![Build Status](https://travis-ci.org/nicksnyder/go-i18n.svg?branch=master)](http://travis-ci.org/nicksnyder/go-i18n) [![Sourcegraph](https://sourcegraph.com/github.com/nicksnyder/go-i18n/-/badge.svg)](https://sourcegraph.com/github.com/nicksnyder/go-i18n?badge)
=======

go-i18n is a Go [package](#i18n-package) and a [command](#goi18n-command) that helps you translate Go programs into multiple languages.
* Supports [pluralized strings](http://cldr.unicode.org/index/cldr-spec/plural-rules) for all 200+ languages in the [Unicode Common Locale Data Repository (CLDR)](http://www.unicode.org/cldr/charts/28/supplemental/language_plural_rules.html).
  *  Code and tests are [automatically generated](https://github.com/nicksnyder/go-i18n/tree/master/i18n/language/codegen) from [CLDR data](http://cldr.unicode.org/index/downloads)
* Supports strings with named variables using [text/template](http://golang.org/pkg/text/template/) syntax.
* Translation files are simple JSON, TOML or YAML.
* [Documented](http://godoc.org/github.com/nicksnyder/go-i18n) and [tested](https://travis-ci.org/nicksnyder/go-i18n)!

Package i18n [![GoDoc](http://godoc.org/github.com/nicksnyder/go-i18n?status.svg)](http://godoc.org/github.com/nicksnyder/go-i18n/i18n)
------------

The i18n package provides runtime APIs for fetching translated strings.

Command goi18n [![GoDoc](http://godoc.org/github.com/nicksnyder/go-i18n?status.svg)](http://godoc.org/github.com/nicksnyder/go-i18n/goi18n)
--------------

The goi18n command provides functionality for managing the translation process.

Installation
------------

Make sure you have [setup GOPATH](http://golang.org/doc/code.html#GOPATH).

    go get -u github.com/nicksnyder/go-i18n/goi18n
    goi18n -help

Workflow
--------

A typical workflow looks like this:

1. Add a new string to your source code.

    ```go
    T("settings_title")
    ```

2. Add the string to en-US.all.json

    ```json
    [
      {
        "id": "settings_title",
        "translation": "Settings"
      }
    ]
    ```

3. Run goi18n

    ```
    goi18n path/to/*.all.json
    ```

4. Send `path/to/*.untranslated.json` to get translated.
5. Run goi18n again to merge the translations

    ```sh
    goi18n path/to/*.all.json path/to/*.untranslated.json
    ```

Translation files
-----------------

A translation file stores translated and untranslated strings.

Here is an example of the default file format that go-i18n supports:

```json
[
  {
    "id": "d_days",
    "translation": {
      "one": "{{.Count}} day",
      "other": "{{.Count}} days"
    }
  },
  {
    "id": "my_height_in_meters",
    "translation": {
      "one": "I am {{.Count}} meter tall.",
      "other": "I am {{.Count}} meters tall."
    }
  },
  {
    "id": "person_greeting",
    "translation": "Hello {{.Person}}"
  },
  {
    "id": "person_unread_email_count",
    "translation": {
      "one": "{{.Person}} has {{.Count}} unread email.",
      "other": "{{.Person}} has {{.Count}} unread emails."
    }
  },
  {
    "id": "person_unread_email_count_timeframe",
    "translation": {
      "one": "{{.Person}} has {{.Count}} unread email in the past {{.Timeframe}}.",
      "other": "{{.Person}} has {{.Count}} unread emails in the past {{.Timeframe}}."
    }
  },
  {
    "id": "program_greeting",
    "translation": "Hello world"
  },
  {
    "id": "your_unread_email_count",
    "translation": {
      "one": "You have {{.Count}} unread email.",
      "other": "You have {{.Count}} unread emails."
    }
  }
]
```

To use a different file format, write a parser for the format and add the parsed translations using [AddTranslation](https://godoc.org/github.com/nicksnyder/go-i18n/i18n#AddTranslation).

Note that TOML only supports the flat format, which is described below.

More examples of translation files: [JSON](https://github.com/nicksnyder/go-i18n/tree/master/goi18n/testdata/input), [TOML](https://github.com/nicksnyder/go-i18n/blob/master/goi18n/testdata/input/flat/ar-ar.one.toml), [YAML](https://github.com/nicksnyder/go-i18n/blob/master/goi18n/testdata/input/yaml/en-us.one.yaml).

Flat Format
-------------

You can also write shorter translation files with flat format.
E.g the example above can be written in this way:

```json
{
  "d_days": {
    "one":  "{{.Count}} day.",
    "other":  "{{.Count}} days."
  },

  "my_height_in_meters": {
    "one":  "I am {{.Count}} meter tall.",
    "other":  "I am {{.Count}} meters tall."
  },

  "person_greeting": {
    "other": "Hello {{.Person}}"
  },

  "person_unread_email_count": {
    "one":  "{{.Person}} has {{.Count}} unread email.",
    "other":  "{{.Person}} has {{.Count}} unread emails."
  },

  "person_unread_email_count_timeframe": {
    "one":  "{{.Person}} has {{.Count}} unread email in the past {{.Timeframe}}.",
    "other":  "{{.Person}} has {{.Count}} unread emails in the past {{.Timeframe}}."
  },

  "program_greeting": {
    "other": "Hello world"
  },

  "your_unread_email_count": {
    "one":  "You have {{.Count}} unread email.",
    "other":  "You have {{.Count}} unread emails."
  }
}
```

The logic of flat format is, what it is structure of structures
and name of substructures (ids) should be always a string.
If there is only one key in substructure and it is "other", then it's non-plural
translation, else plural.

More examples of flat format translation files can be found in [goi18n/testdata/input/flat](https://github.com/nicksnyder/go-i18n/tree/master/goi18n/testdata/input/flat).

Contributions
-------------

If you would like to submit a pull request, please

1. Write tests
2. Format code with [goimports](https://github.com/bradfitz/goimports).
3. Read the [common code review comments](https://github.com/golang/go/wiki/CodeReviewComments).

License
-------
go-i18n is available under the MIT license. See the [LICENSE](LICENSE) file for more info.
