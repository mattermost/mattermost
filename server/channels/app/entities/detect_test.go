// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"fmt"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

const securityOwner = "com.example.security"

func installSecurityPatterns(t *testing.T) {
	t.Helper()
	t.Cleanup(func() { RemoveOwner(securityOwner) })
	require.NoError(t, AddType(securityOwner, &model.EntityType{Name: "vuln", DisplayName: "Vulnerability"}))
	require.NoError(t, AddMatcher(securityOwner, &model.EntityMatcher{
		Name:    "vuln.cve",
		Type:    "vuln",
		Pattern: `CVE-[0-9]{4}-[0-9]{4,7}`,
		URL:     "https://nvd.nist.gov/vuln/detail/{value}",
	}))
	require.NoError(t, AddType(securityOwner, &model.EntityType{Name: "ip", DisplayName: "IP address"}))
	require.NoError(t, AddMatcher(securityOwner, &model.EntityMatcher{
		Name:    "ip.v4",
		Type:    "ip",
		Pattern: `(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}`,
	}))
	require.NoError(t, AddType(securityOwner, &model.EntityType{Name: "attack", DisplayName: "ATT&CK"}))
	require.NoError(t, AddMatcher(securityOwner, &model.EntityMatcher{
		Name:    "attack.technique",
		Type:    "attack",
		Pattern: `T[0-9]{4}(?:\.[0-9]{3})?`,
	}))
}

func TestTimestampWithSecondsIsNotHiddenByEmoji(t *testing.T) {
	const owner = "com.example.clock"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "time", DisplayName: "Time"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:     "time.iso",
		Type:     "time",
		Pattern:  `\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})`,
		Boundary: "field",
	}))

	for _, message := range []string{
		"see 2026-08-09T16:30:00Z now",
		"see 2026-08-09T20:30:00+04:00 now",
		"DTG: 2026-08-09T16:30:00Z",
	} {
		found, _ := Detect(message)
		require.Len(t, found, 1, message)
		require.Contains(t, found[0].Value, "T")
	}

	smile := "hi :smile: there"
	mask := protectedMask(smile)
	start := strings.Index(smile, ":smile:")
	for i := start; i < start+len(":smile:"); i++ {
		require.True(t, mask[i], "emoji byte %d", i)
	}
}

func TestDetectsNothingWithoutRegistrations(t *testing.T) {
	entities, _ := Detect("see CVE-2024-12345 and 141.98.9.137 and T1190")
	require.Empty(t, entities)
}

func TestDetectCVEAndIP(t *testing.T) {
	installSecurityPatterns(t)
	entities, _ := Detect("see CVE-2024-12345 and 141.98.9.137 today")
	require.Len(t, entities, 2)

	require.Equal(t, securityOwner+":vuln", entities[0].TypeIDs[0])
	require.Equal(t, "CVE-2024-12345", entities[0].Value)
	require.Equal(t, "https://nvd.nist.gov/vuln/detail/CVE-2024-12345", entities[0].URL)
	require.Equal(t, entities[0].Value, "see CVE-2024-12345 and 141.98.9.137 today"[entities[0].Start:entities[0].End])

	require.Equal(t, securityOwner+":ip", entities[1].TypeIDs[0])
	require.Equal(t, "141.98.9.137", entities[1].Value)
	require.Empty(t, entities[1].URL)
}

func TestDetectSkipsCodeLinksMentionsAndVersions(t *testing.T) {
	installSecurityPatterns(t)
	message := "plain CVE-2021-44228\n```\nCVE-2019-0001\n```\n`CVE-2018-0001` and http://10.1.1.1/x and @user 1.2.3.4-beta"
	entities, protected := Detect(message)
	require.Len(t, entities, 1)
	require.Equal(t, "CVE-2021-44228", entities[0].Value)
	require.NotEmpty(t, protected)
}

func TestDetectUTF16Offsets(t *testing.T) {
	installSecurityPatterns(t)
	message := "👍 CVE-2020-1234"
	entities, _ := Detect(message)
	require.Len(t, entities, 1)
	require.Equal(t, "CVE-2020-1234", entities[0].Value)
	utf16Start := 0
	for _, r := range message {
		if r == 'C' {
			break
		}
		if r > 0xFFFF {
			utf16Start += 2
		} else {
			utf16Start++
		}
	}
	require.Equal(t, utf16Start, entities[0].Start)
	require.Equal(t, "CVE-2020-1234", message[indexOf(message, "CVE-2020-1234"):])
}

func TestLongerSpanWins(t *testing.T) {
	hits := resolve([]hit{
		{matcherID: "short", typeIDs: []string{"a"}, byteStart: 0, byteEnd: 3, value: "abc"},
		{matcherID: "long", typeIDs: []string{"b"}, byteStart: 2, byteEnd: 8, value: "cdefgh"},
	})
	require.Len(t, hits, 1)
	require.Equal(t, "long", hits[0].matcherID)
}

func TestDetectAttackTechnique(t *testing.T) {
	installSecurityPatterns(t)
	entities, _ := Detect("exploited via T1190 and T1134.001, not T1190-old or XT1190")
	require.Len(t, entities, 2)
	require.Equal(t, "T1190", entities[0].Value)
	require.Equal(t, securityOwner+":attack", entities[0].TypeIDs[0])
	require.Equal(t, "T1134.001", entities[1].Value)
}

func TestApplyTermsKeepsPatternsAndSkipsCode(t *testing.T) {
	installSecurityPatterns(t)
	const owner = "com.example.glossary"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "acronym", DisplayName: "Acronym"}))
	before := PatternGeneration()
	_, _, err := ReplaceTerms(owner, owner+":acronym", []model.EntityTerm{{
		Value: "MLT",
		Title: "Mattermost leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)
	require.Equal(t, before, PatternGeneration())

	message := "see CVE-2024-12345 🙂 ask the MLT, not `MLT` or MLTs"
	patterns, protected := Detect(message)
	require.Len(t, patterns, 1)
	require.Equal(t, "CVE-2024-12345", patterns[0].Value)

	found := ApplyTerms(message, protected, patterns)
	require.Len(t, found, 2)
	require.Equal(t, "CVE-2024-12345", found[0].Value)
	require.Equal(t, "MLT", found[1].Value)
	require.Equal(t, "Mattermost leadership team", found[1].Title)
	require.Equal(t, utf16Index(message, indexOf(message, "MLT")), found[1].Start)
	require.Equal(t, before, PatternGeneration())
}

func TestApplyTermsFillsTitleOnTheSameSpan(t *testing.T) {
	const owner = "com.example.glossary"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "acronym", DisplayName: "Acronym"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "acronym.scan",
		Type:    "acronym",
		Pattern: `MLT`,
	}))
	_, _, err := ReplaceTerms(owner, owner+":acronym", []model.EntityTerm{{
		Value: "MLT",
		Title: "Mattermost leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)

	message := "ask the MLT today"
	patterns, protected := Detect(message)
	require.Len(t, patterns, 1)
	require.Empty(t, patterns[0].Title)

	found := ApplyTerms(message, protected, patterns)
	require.Len(t, found, 1)
	require.Equal(t, "Mattermost leadership team", found[0].Title)
	require.Equal(t, "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz", found[0].URL)
	require.Equal(t, []string{owner + ":acronym"}, found[0].TypeIDs)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func TestJiraLinkUsesTheNamedGroup(t *testing.T) {
	const owner = "com.example.links"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "jira", DisplayName: "Jira"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:     "jira.scan",
		Type:     "jira",
		Pattern:  `(MM)-(?P<jira_id>\d+)`,
		URL:      "https://jira.example.com/browse/{value}",
		Boundary: "autolink",
		Scope:    []string{"ex/town-square"},
		SkipBots: true,
	}))
	message := "Can someone take MM-123?"
	found, _ := Detect(message)
	require.Len(t, found, 1)
	require.Equal(t, "MM-123", found[0].Value)
	require.Equal(t, "https://jira.example.com/browse/MM-123", found[0].URL)
	require.False(t, found[0].HasCard)

	shown := Present(found, ReadContext{TeamName: "ex", ChannelName: "town-square"})
	require.Len(t, shown, 1)
	require.Empty(t, Present(found, ReadContext{DirectOrGroup: true}))
	require.Empty(t, Present(found, ReadContext{AuthorIsBot: true}))

	before := PatternGeneration()
	require.NoError(t, UnregisterMatcher(owner, "jira.scan"))
	require.NotEqual(t, before, PatternGeneration())
	again, _ := Detect(message)
	require.Empty(t, again)
}

func TestStrictBoundaryRejectsADottedTail(t *testing.T) {
	const owner = "com.example.strict"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "ip", DisplayName: "IP address"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:     "ip.v4",
		Type:     "ip",
		Pattern:  `(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}`,
		Boundary: "strict",
	}))
	found, _ := Detect("see 1.2.3.4.5 today and 8.8.8.8.")
	require.Empty(t, found)
	plain, _ := Detect("see 8.8.8.8 today")
	require.Len(t, plain, 1)
}

func TestValueGroupLooksUpTheCapturedText(t *testing.T) {
	const owner = "com.example.freq"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "freq", DisplayName: "Frequency"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:       "freq.mhz",
		Type:       "freq",
		Pattern:    `FREQ:[ \t]*([0-9]+(?:\.[0-9]+)?)`,
		ValueGroup: 1,
	}))

	found, _ := Detect("use FREQ: 243.0 now")
	require.Len(t, found, 1)
	require.Equal(t, "243.0", found[0].Value)
	_, _, err := Prepare(t.Context(), owner+":freq", found[0].Value)
	require.NoError(t, err)
	_, _, err = Prepare(t.Context(), owner+":freq", "nope")
	require.Error(t, err)
}

func TestValueGroupSkipsWhenTheGroupDidNotParticipate(t *testing.T) {
	const owner = "com.example.alt"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:       "mark.alt",
		Type:       "mark",
		Pattern:    `(?:FOO:([0-9]+)|BAR)`,
		ValueGroup: 1,
	}))

	found, _ := Detect("see FOO:12 and BAR here")
	require.Len(t, found, 1)
	require.Equal(t, "12", found[0].Value)
}

func TestImpossibleRFC3339IsNotPublished(t *testing.T) {
	found, _ := Detect("shipped 2024-99-99T99:99:99Z today")
	require.Empty(t, found)
}

func TestDetectCapsAtMaxEntities(t *testing.T) {
	const owner = "com.example.budget"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "mark.scan",
		Type:    "mark",
		Pattern: `MARK-[0-9]{4}`,
	}))

	var body strings.Builder
	for i := range maxEntities + 20 {
		fmt.Fprintf(&body, " MARK-%04d", i)
	}
	found, _ := Detect(body.String())
	require.Len(t, found, maxEntities)
}

func TestScopedMatcherDoesNotHideAGlobalOne(t *testing.T) {
	const owner = "com.example.scope"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "wide", DisplayName: "Wide"}))
	require.NoError(t, AddType(owner, &model.EntityType{Name: "narrow", DisplayName: "Narrow"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "wide.scan",
		Type:    "wide",
		Pattern: `MARK-[0-9]{4}`,
	}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "narrow.scan",
		Type:    "narrow",
		Pattern: `SEE MARK-[0-9]{4}`,
		Scope:   []string{"team/town-square"},
	}))

	found, _ := Detect("SEE MARK-2048")
	require.Len(t, found, 2)
	outside := Present(found, ReadContext{})
	require.Len(t, outside, 1)
	require.Equal(t, "MARK-2048", outside[0].Value)
	inside := Present(found, ReadContext{TeamName: "team", ChannelName: "town-square"})
	require.Len(t, inside, 2)
}

func TestRemovedMatcherIsNotPresented(t *testing.T) {
	const owner = "com.example.gone"
	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "mark.scan",
		Type:    "mark",
		Pattern: `MARK-[0-9]{4}`,
	}))
	found, _ := Detect("see MARK-2048 today")
	require.Len(t, found, 1)
	RemoveOwner(owner)
	require.Empty(t, Present(found, ReadContext{}))
}

func TestRenamedTypeUpdatesTheTermDisplayName(t *testing.T) {
	const owner = "com.example.loaded"
	t.Cleanup(func() { RemoveOwner(owner) })
	typeID := owner + ":acronym"
	require.NoError(t, AddType(owner, &model.EntityType{Name: "acronym", DisplayName: "Acronym"}))
	_, _, err := ReplaceTerms(owner, typeID, []model.EntityTerm{{
		Value: "MLT",
		Title: "Leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)
	before := TermEpoch()
	require.NoError(t, AddType(owner, &model.EntityType{Name: "acronym", DisplayName: "Abbreviation"}))
	require.NotEqual(t, before, TermEpoch())
	shown := ApplyTerms("ask the MLT", nil, nil)
	require.Len(t, shown, 1)
	require.Equal(t, "Abbreviation", shown[0].DisplayName)
	require.Empty(t, shown[0].MatcherID)
}

func TestMatcherChangesThePatternGeneration(t *testing.T) {
	const owner = "com.example.generation"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "mark.scan",
		Type:    "mark",
		Pattern: `MARK-[0-9]{4}`,
	}))
	before := PatternGeneration()
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "mark.scan",
		Type:    "mark",
		Pattern: `MARK-[0-9]{5}`,
	}))
	require.NotEqual(t, before, PatternGeneration())
	renamed := PatternGeneration()
	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Marker"}))
	require.NotEqual(t, renamed, PatternGeneration())
}

func TestCardBodyIgnoresTheFallbackSentence(t *testing.T) {
	require.False(t, model.EntityCardHasBody(&model.EntityCard{Title: "MM-123", URL: "https://jira.example.com/browse/MM-123"}))
	require.False(t, model.EntityCardHasBody(&model.EntityCard{Summary: model.EntityCardFallbackSummary}))
	require.True(t, model.EntityCardHasBody(&model.EntityCard{Rows: []model.EntityCardRow{{Label: "Status", Value: "Open"}}}))
}
