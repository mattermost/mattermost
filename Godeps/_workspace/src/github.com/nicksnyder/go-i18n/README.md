go-i18n [![Build Status](https://secure.travis-ci.org/nicksnyder/go-i18n.png?branch=master)](http://travis-ci.org/nicksnyder/go-i18n)
=======

go-i18n is a Go [package](#i18n-package) and a [command](#goi18n-command) that helps you translate Go programs into multiple languages.
* Supports [pluralized strings](http://cldr.unicode.org/index/cldr-spec/plural-rules) for all 200+ languages in the [Unicode Common Locale Data Repository (CLDR)](http://www.unicode.org/cldr/charts/28/supplemental/language_plural_rules.html).
  *  Code and tests are [automatically generated](https://github.com/nicksnyder/go-i18n/tree/master/i18n/language/codegen) from [CLDR data](http://cldr.unicode.org/index/downloads)
* Supports strings with named variables using [text/template](http://golang.org/pkg/text/template/) syntax.
* Translation files are simple JSON or YAML.
* [Documented](http://godoc.org/github.com/nicksnyder/go-i18n) and [tested](https://travis-ci.org/nicksnyder/go-i18n)!

Package i18n [![GoDoc](http://godoc.org/github.com/nicksnyder/go-i18n?status.png)](http://godoc.org/github.com/nicksnyder/go-i18n/i18n)
------------

The i18n package provides runtime APIs for fetching translated strings.

Command goi18n [![GoDoc](http://godoc.org/github.com/nicksnyder/go-i18n?status.png)](http://godoc.org/github.com/nicksnyder/go-i18n/goi18n)
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

Example:

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

Contributions
-------------

If you would like to submit a pull request, please

1. Write tests
2. Format code with [goimports](https://github.com/bradfitz/goimports).
3. Read the [common code review comments](https://github.com/golang/go/wiki/CodeReviewComments).

License
-------
go-i18n is available under the MIT license. See the [LICENSE](LICENSE) file for more info.
