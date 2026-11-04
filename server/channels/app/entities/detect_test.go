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

const securityPlugin = "com.example.security"

func installSecurityPatterns(t *testing.T) {
	t.Helper()
	t.Cleanup(func() { RemovePlugin(securityPlugin) })
	require.NoError(t, AddType(securityPlugin, &model.EntityType{ID: securityPlugin + ".vuln", DisplayName: "Vulnerability"}))
	require.NoError(t, AddMatcher(securityPlugin, &model.EntityMatcher{
		ID:      securityPlugin + ".vuln.cve",
		TypeID:  securityPlugin + ".vuln",
		Pattern: `CVE-[0-9]{4}-[0-9]{4,7}`,
		URL:     "https://nvd.nist.gov/vuln/detail/{value}",
	}))
	require.NoError(t, AddType(securityPlugin, &model.EntityType{ID: securityPlugin + ".ip", DisplayName: "IP address"}))
	require.NoError(t, AddMatcher(securityPlugin, &model.EntityMatcher{
		ID:      securityPlugin + ".ip.v4",
		TypeID:  securityPlugin + ".ip",
		Pattern: `(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}`,
	}))
	require.NoError(t, AddType(securityPlugin, &model.EntityType{ID: securityPlugin + ".attack", DisplayName: "ATT&CK"}))
	require.NoError(t, AddMatcher(securityPlugin, &model.EntityMatcher{
		ID:      securityPlugin + ".attack.technique",
		TypeID:  securityPlugin + ".attack",
		Pattern: `T[0-9]{4}(?:\.[0-9]{3})?`,
	}))
}

func TestTimestampWithSecondsIsNotHiddenByEmoji(t *testing.T) {
	const pluginID = "com.example.clock"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".time", DisplayName: "Time"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:       pluginID + ".time.iso",
		TypeID:   pluginID + ".time",
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

func TestDetectsNothingWithoutPlugins(t *testing.T) {
	entities, _ := Detect("see CVE-2024-12345 and 141.98.9.137 and T1190")
	require.Empty(t, entities)
}

func TestDetectCVEAndIP(t *testing.T) {
	installSecurityPatterns(t)
	entities, _ := Detect("see CVE-2024-12345 and 141.98.9.137 today")
	require.Len(t, entities, 2)

	require.Equal(t, securityPlugin+".vuln", entities[0].TypeIDs[0])
	require.Equal(t, "CVE-2024-12345", entities[0].Value)
	require.Equal(t, "https://nvd.nist.gov/vuln/detail/CVE-2024-12345", entities[0].URL)
	require.Equal(t, entities[0].Value, "see CVE-2024-12345 and 141.98.9.137 today"[entities[0].Start:entities[0].End])

	require.Equal(t, securityPlugin+".ip", entities[1].TypeIDs[0])
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
	encoded := []rune(message)
	utf16Start := 0
	for _, r := range encoded {
		if string(r) == "C" {
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
	require.Equal(t, securityPlugin+".attack", entities[0].TypeIDs[0])
	require.Equal(t, "T1134.001", entities[1].Value)
}

func TestApplyTermsKeepsPatternsAndSkipsCode(t *testing.T) {
	installSecurityPatterns(t)
	const pluginID = "com.example.glossary"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".acronym", DisplayName: "Acronym"}))
	before := PatternGeneration()
	_, err := ReplaceTerms(pluginID, pluginID+".acronym", []model.EntityTerm{{
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
	const pluginID = "com.example.glossary"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".acronym", DisplayName: "Acronym"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:      pluginID + ".acronym.scan",
		TypeID:  pluginID + ".acronym",
		Pattern: `MLT`,
	}))
	_, err := ReplaceTerms(pluginID, pluginID+".acronym", []model.EntityTerm{{
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
	require.Equal(t, []string{pluginID + ".acronym"}, found[0].TypeIDs)
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
	const pluginID = "com.example.links"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".jira", DisplayName: "Jira"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:       pluginID + ".jira.scan",
		TypeID:   pluginID + ".jira",
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
	require.NoError(t, UnregisterMatcher(pluginID, pluginID+".jira.scan"))
	require.NotEqual(t, before, PatternGeneration())
	again, _ := Detect(message)
	require.Empty(t, again)
}

func TestStrictBoundaryRejectsADottedTail(t *testing.T) {
	const pluginID = "com.example.strict"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".ip", DisplayName: "IP address"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:       pluginID + ".ip.v4",
		TypeID:   pluginID + ".ip",
		Pattern:  `(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}`,
		Boundary: "strict",
	}))
	found, _ := Detect("see 1.2.3.4.5 today and 8.8.8.8.")
	require.Empty(t, found)
	plain, _ := Detect("see 8.8.8.8 today")
	require.Len(t, plain, 1)
}

func TestValidateErrorLeavesTheScanIncomplete(t *testing.T) {
	const pluginID = "com.example.validate"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".time", DisplayName: "Time"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:       pluginID + ".time.short",
		TypeID:   pluginID + ".time",
		Pattern:  `\d{6}Z`,
		Validate: true,
	}))
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".vuln", DisplayName: "Vulnerability"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:      pluginID + ".vuln.cve",
		TypeID:  pluginID + ".vuln",
		Pattern: `CVE-[0-9]{4}-[0-9]{4,7}`,
	}))

	found, _, incomplete := DetectAccepted("see 311200Z and CVE-2024-1234", func(string, string, string) (bool, error) {
		return false, fmt.Errorf("plugin is down")
	})
	require.True(t, incomplete)
	require.Len(t, found, 1)
	require.Equal(t, "CVE-2024-1234", found[0].Value)

	rejected, _, done := DetectAccepted("see 311200Z today", func(string, string, string) (bool, error) {
		return false, nil
	})
	require.False(t, done)
	require.Empty(t, rejected)
}

func TestValueGroupLooksUpTheCapturedText(t *testing.T) {
	const pluginID = "com.example.freq"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".freq", DisplayName: "Frequency"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:         pluginID + ".freq.mhz",
		TypeID:     pluginID + ".freq",
		Pattern:    `FREQ:[ \t]*([0-9]+(?:\.[0-9]+)?)`,
		ValueGroup: 1,
	}))

	found, _ := Detect("use FREQ: 243.0 now")
	require.Len(t, found, 1)
	require.Equal(t, "243.0", found[0].Value)
	_, _, err := Prepare(t.Context(), pluginID+".freq", found[0].Value)
	require.NoError(t, err)
	_, _, err = Prepare(t.Context(), pluginID+".freq", "nope")
	require.Error(t, err)
}

func TestValidateStopsAfterTheEntityCap(t *testing.T) {
	const pluginID = "com.example.budget"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".time", DisplayName: "Time"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:       pluginID + ".time.short",
		TypeID:   pluginID + ".time",
		Pattern:  `\d{6}Z`,
		Validate: true,
	}))

	var calls int
	var body strings.Builder
	for i := 0; i < maxEntities+20; i++ {
		fmt.Fprintf(&body, " %06dZ", i)
	}
	_, _, incomplete := DetectAccepted(body.String(), func(string, string, string) (bool, error) {
		calls++
		return true, nil
	})
	require.True(t, incomplete)
	require.Equal(t, maxEntities, calls)
}

func TestScopedMatcherDoesNotHideAGlobalOne(t *testing.T) {
	const pluginID = "com.example.scope"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".wide", DisplayName: "Wide"}))
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".narrow", DisplayName: "Narrow"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:      pluginID + ".wide.scan",
		TypeID:  pluginID + ".wide",
		Pattern: `MARK-[0-9]{4}`,
	}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:      pluginID + ".narrow.scan",
		TypeID:  pluginID + ".narrow",
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
	const pluginID = "com.example.gone"
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:      pluginID + ".mark.scan",
		TypeID:  pluginID + ".mark",
		Pattern: `MARK-[0-9]{4}`,
	}))
	found, _ := Detect("see MARK-2048 today")
	require.Len(t, found, 1)
	RemovePlugin(pluginID)
	require.Empty(t, Present(found, ReadContext{}))
}

func TestLoadedTermTakesItsDisplayNameWhenTheTypeArrives(t *testing.T) {
	snap := SnapshotTerms()
	t.Cleanup(func() {
		RestoreTerms(snap)
		RemovePlugin("com.example.loaded")
	})
	const pluginID = "com.example.loaded"
	typeID := pluginID + ".acronym"
	LoadTerms([]model.EntityTermRow{{
		TypeID:     typeID,
		PluginID:   pluginID,
		Generation: 3,
		Value:      "MLT",
		Title:      "Leadership team",
		URL:        "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	shown := ApplyTerms("ask the MLT", nil, nil)
	require.Len(t, shown, 1)
	require.Empty(t, shown[0].DisplayName)
	require.Empty(t, shown[0].MatcherID)

	require.NoError(t, AddType(pluginID, &model.EntityType{ID: typeID, DisplayName: "Acronym"}))
	shown = ApplyTerms("ask the MLT", nil, nil)
	require.Equal(t, "Acronym", shown[0].DisplayName)
}

func TestValidateChangesThePatternGeneration(t *testing.T) {
	const pluginID = "com.example.generation"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:      pluginID + ".mark.scan",
		TypeID:  pluginID + ".mark",
		Pattern: `MARK-[0-9]{4}`,
	}))
	before := PatternGeneration()
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:       pluginID + ".mark.scan",
		TypeID:   pluginID + ".mark",
		Pattern:  `MARK-[0-9]{4}`,
		Validate: true,
	}))
	require.NotEqual(t, before, PatternGeneration())
	renamed := PatternGeneration()
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".mark", DisplayName: "Marker"}))
	require.NotEqual(t, renamed, PatternGeneration())
}

func TestCardBodyIgnoresTheFallbackSentence(t *testing.T) {
	require.False(t, model.EntityCardHasBody(&model.EntityCard{Title: "MM-123", URL: "https://jira.example.com/browse/MM-123"}))
	require.False(t, model.EntityCardHasBody(&model.EntityCard{Summary: model.EntityCardFallbackSummary}))
	require.True(t, model.EntityCardHasBody(&model.EntityCard{Rows: []model.EntityCardRow{{Label: "Status", Value: "Open"}}}))
}
