package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"reflect"
	"sort"

	"gopkg.in/yaml.v2"

	"github.com/nicksnyder/go-i18n/i18n/bundle"
	"github.com/nicksnyder/go-i18n/i18n/language"
	"github.com/nicksnyder/go-i18n/i18n/translation"
)

type mergeCommand struct {
	translationFiles []string
	sourceLanguage   string
	outdir           string
	format           string
}

func (mc *mergeCommand) execute() error {
	if len(mc.translationFiles) < 1 {
		return fmt.Errorf("need at least one translation file to parse")
	}

	if lang := language.Parse(mc.sourceLanguage); lang == nil {
		return fmt.Errorf("invalid source locale: %s", mc.sourceLanguage)
	}

	marshal, err := newMarshalFunc(mc.format)
	if err != nil {
		return err
	}

	bundle := bundle.New()
	for _, tf := range mc.translationFiles {
		if err := bundle.LoadTranslationFile(tf); err != nil {
			return fmt.Errorf("failed to load translation file %s because %s\n", tf, err)
		}
	}

	translations := bundle.Translations()
	sourceLanguageTag := language.NormalizeTag(mc.sourceLanguage)
	sourceTranslations := translations[sourceLanguageTag]
	if sourceTranslations == nil {
		return fmt.Errorf("no translations found for source locale %s", sourceLanguageTag)
	}
	for translationID, src := range sourceTranslations {
		for _, localeTranslations := range translations {
			if dst := localeTranslations[translationID]; dst == nil || reflect.TypeOf(src) != reflect.TypeOf(dst) {
				localeTranslations[translationID] = src.UntranslatedCopy()
			}
		}
	}

	for localeID, localeTranslations := range translations {
		lang := language.MustParse(localeID)[0]
		all := filter(localeTranslations, func(t translation.Translation) translation.Translation {
			return t.Normalize(lang)
		})
		if err := mc.writeFile("all", all, localeID, marshal); err != nil {
			return err
		}

		untranslated := filter(localeTranslations, func(t translation.Translation) translation.Translation {
			if t.Incomplete(lang) {
				return t.Normalize(lang).Backfill(sourceTranslations[t.ID()])
			}
			return nil
		})
		if err := mc.writeFile("untranslated", untranslated, localeID, marshal); err != nil {
			return err
		}
	}
	return nil
}

func (mc *mergeCommand) parse(arguments []string) {
	flags := flag.NewFlagSet("merge", flag.ExitOnError)
	flags.Usage = usageMerge

	sourceLanguage := flags.String("sourceLanguage", "en-us", "")
	outdir := flags.String("outdir", ".", "")
	format := flags.String("format", "json", "")

	flags.Parse(arguments)

	mc.translationFiles = flags.Args()
	mc.sourceLanguage = *sourceLanguage
	mc.outdir = *outdir
	mc.format = *format
}

func (mc *mergeCommand) SetArgs(args []string) {
	mc.translationFiles = args
}

type marshalFunc func(interface{}) ([]byte, error)

func (mc *mergeCommand) writeFile(label string, translations []translation.Translation, localeID string, marshal marshalFunc) error {
	sort.Sort(translation.SortableByID(translations))
	buf, err := marshal(marshalInterface(translations))
	if err != nil {
		return fmt.Errorf("failed to marshal %s strings to %s because %s", localeID, mc.format, err)
	}
	filename := filepath.Join(mc.outdir, fmt.Sprintf("%s.%s.%s", localeID, label, mc.format))
	if err := ioutil.WriteFile(filename, buf, 0666); err != nil {
		return fmt.Errorf("failed to write %s because %s", filename, err)
	}
	return nil
}

func filter(translations map[string]translation.Translation, filter func(translation.Translation) translation.Translation) []translation.Translation {
	filtered := make([]translation.Translation, 0, len(translations))
	for _, translation := range translations {
		if t := filter(translation); t != nil {
			filtered = append(filtered, t)
		}
	}
	return filtered

}

func newMarshalFunc(format string) (marshalFunc, error) {
	switch format {
	case "json":
		return func(v interface{}) ([]byte, error) {
			return json.MarshalIndent(v, "", "  ")
		}, nil
	case "yaml":
		return func(v interface{}) ([]byte, error) {
			return yaml.Marshal(v)
		}, nil
	}
	return nil, fmt.Errorf("unsupported format: %s\n", format)
}

func marshalInterface(translations []translation.Translation) []interface{} {
	mi := make([]interface{}, len(translations))
	for i, translation := range translations {
		mi[i] = translation.MarshalInterface()
	}
	return mi
}

func usageMerge() {
	fmt.Printf(`Merge translation files.

Usage:

    goi18n merge [options] [files...]

Translation files:

    A translation file contains the strings and translations for a single language.

    Translation file names must have a suffix of a supported format (e.g. .json) and
    contain a valid language tag as defined by RFC 5646 (e.g. en-us, fr, zh-hant, etc.).

    For each language represented by at least one input translation file, goi18n will produce 2 output files:

        xx-yy.all.format
            This file contains all strings for the language (translated and untranslated).
            Use this file when loading strings at runtime.

        xx-yy.untranslated.format
            This file contains the strings that have not been translated for this language.
            The translations for the strings in this file will be extracted from the source language.
            After they are translated, merge them back into xx-yy.all.format using goi18n.

Merging:

    goi18n will merge multiple translation files for the same language.
    Duplicate translations will be merged into the existing translation.
    Non-empty fields in the duplicate translation will overwrite those fields in the existing translation.
    Empty fields in the duplicate translation are ignored.

Adding a new language:

    To produce translation files for a new language, create an empty translation file with the
    appropriate name and pass it in to goi18n.

Options:

    -sourceLanguage tag
        goi18n uses the strings from this language to seed the translations for other languages.
        Default: en-us

    -outdir directory
        goi18n writes the output translation files to this directory.
        Default: .

    -format format
        goi18n encodes the output translation files in this format.
        Supported formats: json, yaml
        Default: json

`)
	os.Exit(1)
}
