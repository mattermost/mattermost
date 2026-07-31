// Deterministic lint for Mattermost Go i18n files (go-i18n v1 list format).
// Layer 1 (runtime guarantee):
//   - file loads with github.com/mattermost/go-i18n (the exact runtime loader),
//     which enforces JSON validity, valid plural categories for the locale,
//     and text/template parse of every translation
//   - id parity vs en.json: no missing ids, no extra ids
// Layer 2 (fidelity):
//   - {{.Var}} tokens used in the target are a subset of the source tokens
//     (an unknown token executes to "<no value>" at runtime)
//   - plural translations define every plural category required by the locale
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/go-i18n/i18n/language"
)

var tokenRe = regexp.MustCompile(`\{\{\s*\.([A-Za-z0-9_]+)\s*\}\}`)

type entry struct {
	ID          string          `json:"id"`
	Translation json.RawMessage `json:"translation"`
}

func tokens(raw json.RawMessage) map[string]bool {
	out := map[string]bool{}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		for _, m := range tokenRe.FindAllStringSubmatch(s, -1) {
			out[m[1]] = true
		}
		return out
	}
	var m map[string]string
	if err := json.Unmarshal(raw, &m); err == nil {
		for _, v := range m {
			for _, t := range tokenRe.FindAllStringSubmatch(v, -1) {
				out[t[1]] = true
			}
		}
	}
	return out
}

func load(path string) (map[string]entry, []string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}
	var list []entry
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, nil, err
	}
	m := map[string]entry{}
	order := make([]string, 0, len(list))
	for _, e := range list {
		m[e.ID] = e
		order = append(order, e.ID)
	}
	return m, order, nil
}

func main() {
	enPath := os.Args[1]
	en, _, err := load(enPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot load %s: %v\n", enPath, err)
		os.Exit(2)
	}
	errs := 0
	for _, path := range os.Args[2:] {
		name := filepath.Base(path)
		localeCode := strings.TrimSuffix(name, ".json")
		// Runtime guarantee: the real loader must accept the file.
		if err := i18n.LoadTranslationFile(path); err != nil {
			fmt.Printf("%s: runtime loader rejected file: %v\n", name, err)
			errs++
			continue
		}
		var pluralCats map[language.Plural]bool
		if spec := language.GetPluralSpec(localeCode); spec != nil {
			pluralCats = map[language.Plural]bool{}
			for c := range spec.Plurals {
				pluralCats[c] = true
			}
		} else {
			fmt.Printf("%s: no CLDR plural spec found for locale %q\n", name, localeCode)
			errs++
		}
		m, _, err := load(path)
		if err != nil {
			fmt.Printf("%s: %v\n", name, err)
			errs++
			continue
		}
		for id := range en {
			if _, ok := m[id]; !ok {
				fmt.Printf("%s: missing id %q\n", name, id)
				errs++
			}
		}
		for id, e := range m {
			src, ok := en[id]
			if !ok {
				fmt.Printf("%s: extra id %q not in en.json\n", name, id)
				errs++
				continue
			}
			srcTok := tokens(src.Translation)
			for t := range tokens(e.Translation) {
				if !srcTok[t] {
					fmt.Printf("%s: %s: unknown template token {{.%s}} not present in source\n", name, id, t)
					errs++
				}
			}
			// plural completeness for the locale
			var plural map[string]string
			if json.Unmarshal(e.Translation, &plural) == nil && pluralCats != nil {
				var enPlural map[string]string
				isPluralSrc := json.Unmarshal(src.Translation, &enPlural) == nil
				if isPluralSrc {
					for c := range pluralCats {
						if _, ok := plural[string(c)]; !ok {
							fmt.Printf("%s: %s: missing plural category %q required for this locale\n", name, id, c)
							errs++
						}
					}
					for c := range plural {
						if !pluralCats[language.Plural(c)] {
							fmt.Printf("%s: %s: plural category %q is not used by this locale\n", name, id, c)
							errs++
						}
					}
				}
			}
		}
	}
	if errs > 0 {
		fmt.Printf("\n%d error(s)\n", errs)
		os.Exit(1)
	}
	fmt.Printf("OK: %d locale files checked against %s\n", len(os.Args)-2, enPath)
}
