// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"cmp"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	maxScanRunes = 16000
	maxEntities  = 100
	markdownMeta = "*_~`[]\\\n\r"
)

type matcher struct {
	id           string
	typeID       string
	pattern      *regexp.Regexp
	valuePattern *regexp.Regexp
	urlTemplate  string
	url          func(value string, groups map[string]string) string
	valueGroup   int
	spanGroup    int
	boundary     string
	scope        []string
	skipBots     bool
	pluginID     string
	displayName  string
}

var (
	linkPattern      = regexp.MustCompile(`\[[^\]\n]*\]\([^)\n]*\)`)
	urlPattern       = regexp.MustCompile(`https?://[^\s<]+`)
	wwwPattern       = regexp.MustCompile(`\bwww\.[^\s<>]+`)
	emailPattern     = regexp.MustCompile(`[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+`)
	referencePattern = regexp.MustCompile(`(?m)^ {0,3}\[[^\]\n]*\]:[^\n]*`)
	mentionPattern   = regexp.MustCompile(`(?:^|[^\p{L}\p{N}_])[@~][\p{L}\p{N}_.\-]+`)
	emojiPattern     = regexp.MustCompile(`\B:[a-zA-Z0-9_+-]{2,}:\B`)
	usmtfLinePattern = regexp.MustCompile(`^(?:/|[0-9]*[A-Z][A-Z0-9]*(?:/|$))`)
)

// MessageHash identifies the message a row was detected against.
func MessageHash(message string) string {
	sum := sha256.Sum256([]byte(message))
	return hex.EncodeToString(sum[:])
}

type hit struct {
	matcherID   string
	typeIDs     []string
	byteStart   int
	byteEnd     int
	value       string
	url         string
	displayName string
	title       string
	scoped      bool
}

// Detect finds pattern entities in message. Dictionary terms are not included;
// ApplyTerms adds those when a post is read. Protected ranges cover fenced and
// inline code, markdown links, bare URLs, mentions, channel links and emoji
// shortcodes. Spans that contain a markdown metacharacter are dropped.
func Detect(message string) (entities []*model.PostEntity, protected [][2]int) {
	scanned := scanPrefix(message)
	mask := protectedMask(scanned)
	var hits []hit
	for _, m := range activeMatchers() {
		locs := m.pattern.FindAllStringSubmatchIndex(scanned, -1)
		for _, loc := range locs {
			fullStart, fullEnd := loc[0], loc[1]
			if overlapsProtected(mask, fullStart, fullEnd) || !boundaryAllows(m.boundary, scanned, fullStart, fullEnd) {
				continue
			}
			if groupMissing(loc, m.valueGroup) || groupMissing(loc, m.spanGroup) {
				continue
			}
			start, end := groupSpan(loc, m.spanGroup, m.valueGroup)
			valueStart, valueEnd := groupSpan(loc, m.valueGroup, 0)
			if start < 0 || valueStart < 0 || start >= end {
				continue
			}
			value := scanned[valueStart:valueEnd]
			if strings.ContainsAny(value, markdownMeta) || strings.ContainsAny(scanned[start:end], markdownMeta) {
				continue
			}
			if m.typeID == coreTimeTypeID {
				if _, err := parseCoreTime(value); err != nil {
					continue
				}
			}
			h := hit{
				matcherID:   m.id,
				typeIDs:     []string{m.typeID},
				byteStart:   start,
				byteEnd:     end,
				value:       value,
				displayName: m.displayName,
				scoped:      len(m.scope) > 0,
			}
			if m.url != nil {
				h.url = m.url(value, groupsOf(m.pattern, scanned, loc))
			}
			hits = append(hits, h)
		}
	}
	hits = resolve(hits)
	if len(hits) > maxEntities {
		hits = hits[:maxEntities]
	}
	protected = protectedUTF16(scanned, mask)
	return hitsToEntities(scanned, hits), protected
}

// ApplyTerms adds the current dictionary to pattern entities. It does not
// write a row: a term added or removed shows up on the next read of a post
// whose pattern generation is unchanged. Stored pattern spans win. A term on
// exactly the same span merges into that entity and fills an empty title or
// link. Protected ranges are the ones stored with that detection.
func ApplyTerms(message string, protected [][2]int, patterns []*model.PostEntity) []*model.PostEntity {
	if len(activeTerms()) == 0 {
		return patterns
	}
	scanned := scanPrefix(message)
	mask := maskFromUTF16(scanned, protected)
	base := patternHits(scanned, patterns)
	terms := appendTermHits(scanned, mask, nil)
	merged := mergeTermHits(base, terms)
	if len(merged) > maxEntities {
		merged = merged[:maxEntities]
	}
	return hitsToEntities(scanned, merged)
}

func hitsToEntities(scanned string, hits []hit) []*model.PostEntity {
	entities := make([]*model.PostEntity, 0, len(hits))
	for _, h := range hits {
		start := utf16Index(scanned, h.byteStart)
		end := utf16Index(scanned, h.byteEnd)
		entities = append(entities, &model.PostEntity{
			ID:          fmt.Sprintf("%d:%d", start, end),
			Start:       start,
			End:         end,
			TypeIDs:     h.typeIDs,
			MatcherID:   h.matcherID,
			Value:       h.value,
			URL:         h.url,
			DisplayName: h.displayName,
			Title:       h.title,
		})
	}
	return entities
}

func patternHits(scanned string, patterns []*model.PostEntity) []hit {
	hits := make([]hit, 0, len(patterns))
	for _, entity := range patterns {
		if entity == nil {
			continue
		}
		start := byteIndexAtUTF16(scanned, entity.Start)
		end := byteIndexAtUTF16(scanned, entity.End)
		if start >= end || end > len(scanned) {
			continue
		}
		hits = append(hits, hit{
			matcherID:   entity.MatcherID,
			typeIDs:     append([]string(nil), entity.TypeIDs...),
			byteStart:   start,
			byteEnd:     end,
			value:       entity.Value,
			url:         entity.URL,
			displayName: entity.DisplayName,
			title:       entity.Title,
		})
	}
	return hits
}

func mergeTermHits(patterns, terms []hit) []hit {
	accepted := append([]hit(nil), patterns...)
	for _, h := range terms {
		if termMerged(accepted, h) {
			continue
		}
		if len(accepted) >= maxEntities {
			continue
		}
		accepted = append(accepted, h)
	}
	slices.SortFunc(accepted, func(a, b hit) int {
		return cmp.Compare(a.byteStart, b.byteStart)
	})
	return accepted
}

func termMerged(accepted []hit, h hit) bool {
	for i := range accepted {
		if h.byteStart >= accepted[i].byteEnd || accepted[i].byteStart >= h.byteEnd {
			continue
		}
		if h.byteStart == accepted[i].byteStart && h.byteEnd == accepted[i].byteEnd {
			for _, typeID := range h.typeIDs {
				if !containsType(accepted[i].typeIDs, typeID) {
					accepted[i].typeIDs = append(accepted[i].typeIDs, typeID)
				}
			}
			if accepted[i].title == "" {
				accepted[i].title = h.title
			}
			if accepted[i].url == "" {
				accepted[i].url = h.url
			}
			if accepted[i].displayName == "" {
				accepted[i].displayName = h.displayName
			}
		}
		return true
	}
	return false
}

func scanPrefix(message string) string {
	n := 0
	for i := range message {
		if n == maxScanRunes {
			return message[:i]
		}
		n++
	}
	return message
}

func appendTermHits(scanned string, mask []bool, hits []hit) []hit {
	terms := activeTerms()
	if len(terms) == 0 {
		return hits
	}
	byValue := map[string][]storedTerm{}
	for _, term := range terms {
		byValue[term.value] = append(byValue[term.value], term)
	}
	for i := 0; i < len(scanned); {
		r, size := utf8.DecodeRuneInString(scanned[i:])
		if !isWord(r) {
			i += size
			continue
		}
		start := i
		for i < len(scanned) {
			r, size = utf8.DecodeRuneInString(scanned[i:])
			if !isWord(r) {
				break
			}
			i += size
		}
		end := i
		if !boundaryOK(scanned, start, end) || overlapsProtected(mask, start, end) {
			continue
		}
		value := scanned[start:end]
		matches := byValue[value]
		if len(matches) == 0 || strings.ContainsAny(value, markdownMeta) {
			continue
		}
		h := hit{
			byteStart:   start,
			byteEnd:     end,
			value:       value,
			url:         matches[0].url,
			displayName: matches[0].displayName,
			title:       matches[0].title,
		}
		for _, match := range matches {
			if !containsType(h.typeIDs, match.typeID) {
				h.typeIDs = append(h.typeIDs, match.typeID)
			}
		}
		hits = append(hits, h)
	}
	return hits
}

func resolve(hits []hit) []hit {
	slices.SortFunc(hits, func(a, b hit) int {
		li := a.byteEnd - a.byteStart
		lj := b.byteEnd - b.byteStart
		if c := cmp.Compare(lj, li); c != 0 {
			return c
		}
		if c := cmp.Compare(a.byteStart, b.byteStart); c != 0 {
			return c
		}
		return cmp.Compare(a.matcherID, b.matcherID)
	})
	var accepted []hit
	for _, h := range hits {
		merged := false
		suppressed := false
		for i := range accepted {
			if h.byteStart >= accepted[i].byteEnd || accepted[i].byteStart >= h.byteEnd {
				continue
			}
			if h.byteStart == accepted[i].byteStart && h.byteEnd == accepted[i].byteEnd {
				for _, typeID := range h.typeIDs {
					if !containsType(accepted[i].typeIDs, typeID) {
						accepted[i].typeIDs = append(accepted[i].typeIDs, typeID)
					}
				}
				if accepted[i].scoped && !h.scoped {
					accepted[i].matcherID = h.matcherID
					accepted[i].scoped = false
					accepted[i].value = h.value
					accepted[i].url = h.url
					accepted[i].displayName = h.displayName
				}
				merged = true
				break
			}
			if accepted[i].scoped == h.scoped {
				suppressed = true
				break
			}
		}
		if merged || suppressed {
			continue
		}
		accepted = append(accepted, h)
	}
	slices.SortFunc(accepted, func(a, b hit) int {
		return cmp.Compare(a.byteStart, b.byteStart)
	})
	return accepted
}

func containsType(have []string, want string) bool {
	return slices.Contains(have, want)
}

func boundaryOK(s string, start, end int) bool {
	return boundaryAllows("", s, start, end)
}

func neighbors(s string, start, end int) (before, after rune) {
	if start > 0 {
		before, _ = utf8.DecodeLastRuneInString(s[:start])
	}
	if end < len(s) {
		after, _ = utf8.DecodeRuneInString(s[end:])
	}
	return before, after
}

func boundaryAllows(preset, s string, start, end int) bool {
	before, after := neighbors(s, start, end)
	switch preset {
	case "", "token":
		if before != 0 && isWord(before) {
			return false
		}
		return after == 0 || (!isWord(after) && after != '-')
	case "strict":
		return !strictNeighbor(before) && !strictNeighbor(after)
	case "field":
		if !wordBoundary(s, start, end) {
			return false
		}
		return before != '/' && before != ':' && after != '/' && after != ':'
	case "word":
		return wordBoundary(s, start, end)
	case "autolink":
		return autolinkPrefix(before) && autolinkSuffix(after)
	case "autolink_prefix_off":
		return autolinkSuffix(after)
	case "autolink_suffix_off":
		return autolinkPrefix(before)
	case "autolink_guards_off", "none":
		return true
	default:
		return false
	}
}

func strictNeighbor(r rune) bool {
	if r == 0 {
		return false
	}
	switch r {
	case '.', ',', '-', '+', '/', ':':
		return true
	default:
		return isWord(r)
	}
}

func wordBoundary(s string, start, end int) bool {
	if start >= end || end > len(s) {
		return false
	}
	first, _ := utf8.DecodeRuneInString(s[start:end])
	last, _ := utf8.DecodeLastRuneInString(s[start:end])
	before, after := neighbors(s, start, end)
	beforeWord := before != 0 && isWord(before)
	afterWord := after != 0 && isWord(after)
	return isWord(first) != beforeWord && isWord(last) != afterWord
}

func autolinkPrefix(r rune) bool {
	return r == 0 || unicode.IsSpace(r)
}

func autolinkSuffix(r rune) bool {
	switch r {
	case 0, ' ', '\t', '\n', '\r', '.', '!', '?', ',', ')':
		return true
	default:
		return unicode.IsSpace(r)
	}
}

func groupMissing(loc []int, group int) bool {
	return group > 0 && (group*2+1 >= len(loc) || loc[group*2] < 0)
}

func groupSpan(loc []int, group, fallback int) (int, int) {
	chosen := group
	if chosen == 0 {
		chosen = fallback
	}
	if chosen > 0 && chosen*2+1 < len(loc) && loc[chosen*2] >= 0 {
		return loc[chosen*2], loc[chosen*2+1]
	}
	return loc[0], loc[1]
}

func groupsOf(pattern *regexp.Regexp, s string, loc []int) map[string]string {
	names := pattern.SubexpNames()
	groups := make(map[string]string, len(names))
	for i, name := range names {
		if i == 0 || i*2+1 >= len(loc) || loc[i*2] < 0 {
			continue
		}
		text := s[loc[i*2]:loc[i*2+1]]
		groups[fmt.Sprintf("%d", i)] = text
		if name != "" {
			groups[name] = text
		}
	}
	return groups
}

func isWord(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_'
}

func byteIndexAtUTF16(s string, utf16Index int) int {
	if utf16Index <= 0 {
		return 0
	}
	units := 0
	for i := 0; i < len(s); {
		if units >= utf16Index {
			return i
		}
		r, size := utf8.DecodeRuneInString(s[i:])
		units += utf16.RuneLen(r)
		i += size
	}
	return len(s)
}

func maskFromUTF16(s string, ranges [][2]int) []bool {
	mask := make([]bool, len(s))
	if len(ranges) == 0 {
		return mask
	}
	units := 0
	for i := 0; i < len(s); {
		r, size := utf8.DecodeRuneInString(s[i:])
		next := units + utf16.RuneLen(r)
		for _, rg := range ranges {
			if units < rg[1] && rg[0] < next {
				mark(mask, i, i+size)
				break
			}
		}
		units = next
		i += size
	}
	return mask
}

func utf16Index(s string, byteIndex int) int {
	if byteIndex <= 0 {
		return 0
	}
	if byteIndex > len(s) {
		byteIndex = len(s)
	}
	return len(utf16.Encode([]rune(s[:byteIndex])))
}

func protectedMask(s string) []bool {
	mask := make([]bool, len(s))
	markFences(s, mask, '`')
	markFences(s, mask, '~')
	markInlineCode(s, mask)
	markAll(mask, linkPattern.FindAllStringIndex(s, -1))
	markAll(mask, referencePattern.FindAllStringIndex(s, -1))
	markAll(mask, urlPattern.FindAllStringIndex(s, -1))
	markAll(mask, wwwPattern.FindAllStringIndex(s, -1))
	markAll(mask, emailPattern.FindAllStringIndex(s, -1))
	markUSMTF(s, mask)
	markMentions(s, mask, mentionPattern)
	markAll(mask, emojiPattern.FindAllStringIndex(s, -1))
	return mask
}

func markFences(s string, mask []bool, marker byte) {
	opener := strings.Repeat(string(marker), 3)
	i := 0
	for i < len(s) {
		if !strings.HasPrefix(s[i:], opener) || (i > 0 && s[i-1] != '\n') {
			i++
			continue
		}
		rest := s[i+3:]
		nl := strings.IndexByte(rest, '\n')
		searchFrom := 0
		if nl >= 0 {
			searchFrom = nl + 1
		}
		closeRel := strings.Index(rest[searchFrom:], "\n"+opener)
		if closeRel < 0 {
			mark(mask, i, len(s))
			return
		}
		end := i + 3 + searchFrom + closeRel + 1 + len(opener)
		for end < len(s) && s[end] == marker {
			end++
		}
		if end < len(s) && s[end] == '\n' {
			end++
		}
		mark(mask, i, end)
		i = end
	}
}

func markUSMTF(s string, mask []bool) {
	blockStart, blockEnd, terminated := -1, 0, false
	closeBlock := func() {
		if blockStart >= 0 && terminated {
			mark(mask, blockStart, blockEnd)
		}
		blockStart, terminated = -1, false
	}
	for offset := 0; offset < len(s); {
		lineEnd := strings.IndexByte(s[offset:], '\n')
		next := len(s)
		more := false
		if lineEnd >= 0 {
			lineEnd += offset
			next = lineEnd + 1
			more = true
		} else {
			lineEnd = len(s)
		}
		line := strings.TrimRight(s[offset:lineEnd], " \t\r")
		if usmtfLinePattern.MatchString(line) {
			if blockStart < 0 {
				blockStart = offset
			}
			blockEnd = lineEnd
			terminated = terminated || strings.HasSuffix(line, "//")
		} else {
			closeBlock()
		}
		if !more {
			break
		}
		offset = next
	}
	closeBlock()
}

func markInlineCode(s string, mask []bool) {
	i := 0
	for i < len(s) {
		if i < len(mask) && mask[i] {
			i++
			continue
		}
		if s[i] != '`' {
			i++
			continue
		}
		n := 1
		for i+n < len(s) && s[i+n] == '`' {
			n++
		}
		if n >= 3 {
			i += n
			continue
		}
		ticks := strings.Repeat("`", n)
		closeAt := strings.Index(s[i+n:], ticks)
		if closeAt < 0 {
			i += n
			continue
		}
		end := i + n + closeAt + n
		mark(mask, i, end)
		i = end
	}
}

func markMentions(s string, mask []bool, re *regexp.Regexp) {
	for _, loc := range re.FindAllStringIndex(s, -1) {
		text := s[loc[0]:loc[1]]
		at := strings.IndexAny(text, "@~")
		if at < 0 {
			continue
		}
		mark(mask, loc[0]+at, loc[1])
	}
}

func markAll(mask []bool, locs [][]int) {
	for _, loc := range locs {
		mark(mask, loc[0], loc[1])
	}
}

func mark(mask []bool, start, end int) {
	if start < 0 {
		start = 0
	}
	if end > len(mask) {
		end = len(mask)
	}
	for i := start; i < end; i++ {
		mask[i] = true
	}
}

func overlapsProtected(mask []bool, start, end int) bool {
	for i := start; i < end && i < len(mask); i++ {
		if mask[i] {
			return true
		}
	}
	return false
}

func protectedUTF16(s string, mask []bool) [][2]int {
	var ranges [][2]int
	start := -1
	for i, on := range mask {
		if on && start < 0 {
			start = i
		}
		if !on && start >= 0 {
			ranges = append(ranges, [2]int{utf16Index(s, start), utf16Index(s, i)})
			start = -1
		}
	}
	if start >= 0 {
		ranges = append(ranges, [2]int{utf16Index(s, start), utf16Index(s, len(s))})
	}
	return ranges
}
