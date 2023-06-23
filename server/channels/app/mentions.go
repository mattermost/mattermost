package app

import (
	"fmt"
	"index/suffixarray"
	"regexp"
	"strings"

	"github.com/anknown/ahocorasick"
	"github.com/mattermost/mattermost/server/public/model"
)

func MakePatternFromKeywords(keywords map[string][]string, groups map[string]*model.Group) *regexp.Regexp {
	parts := make([]string, 3+2*len(keywords)+2*len(groups))
	index := 0

	appendPart := func(part string) {
		parts[index] = part
		index += 1
	}

	appendPart(`\B@here\b`)
	appendPart(`\B@all\b`)
	appendPart(`\B@channel\b`)

	startsWithWordCharacter := regexp.MustCompile(`^\w`)
	endsWithWordCharacter := regexp.MustCompile(`\w$`)

	for keyword := range keywords {
		clean := regexp.QuoteMeta(keyword)

		prefix := ""
		suffix := ""
		if startsWithWordCharacter.MatchString(keyword) {
			prefix = `\b`
		} else {
			prefix = `\B`
		}
		if endsWithWordCharacter.MatchString(keyword) {
			suffix = `\b`
		} else {
			suffix = `\B`
		}

		appendPart(fmt.Sprintf("%s%s%s", prefix, clean, suffix))
		appendPart(fmt.Sprintf("%s%s%s", prefix, strings.ToLower(clean), suffix))
	}

	for group := range groups {
		appendPart(fmt.Sprintf(`\B@%s\b`, group))
		appendPart(fmt.Sprintf(`\B@%s\b`, strings.ToLower(group)))
	}

	return regexp.MustCompile(strings.Join(parts, "|"))
}

func (m *ExplicitMentions) processTextNaiveRegex(text string, pattern *regexp.Regexp, keywords map[string][]string, groups map[string]*model.Group) {
	matches := pattern.FindAllString(text, -1)
	for _, match := range matches {
		m.checkForMention(match, keywords, groups)
	}
}

func (m *ExplicitMentions) processTextSuffixArray(text string, pattern *regexp.Regexp, keywords map[string][]string, groups map[string]*model.Group) {
	b := []byte(text)
	index := suffixarray.New(b)

	matches := index.FindAllIndex(pattern, -1)
	for _, match := range matches {
		matchedText := string(b[match[0]:match[1]])

		m.checkForMention(matchedText, keywords, groups)
	}
}

func MakeMachineFromKeywords(keywords map[string][]string, groups map[string]*model.Group) *goahocorasick.Machine {
	dict := make([][]rune, 0, len(keywords))
	for keyword := range keywords {
		dict = append(dict, []rune(keyword))
	}

	m := new(goahocorasick.Machine)
	if err := m.Build(dict); err != nil {
		panic(err)
	}

	return m
}

func (m *ExplicitMentions) processTextAhoCorasick(text string, machine *goahocorasick.Machine, keywords map[string][]string, groups map[string]*model.Group) {
	matches := machine.MultiPatternSearch([]rune(text), false)
	for _, match := range matches {
		matchedText := string(match.Word)

		m.checkForMention(matchedText, keywords, groups)
	}
}
