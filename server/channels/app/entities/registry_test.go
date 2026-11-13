// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestOwnerMatcherIsDetectedAndRemoved(t *testing.T) {
	const owner = "com.example.marks"
	t.Cleanup(func() { RemoveOwner(owner) })

	before := PatternGeneration()
	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:       "mark.scan",
		Type:       "mark",
		Pattern:    `MARK-[0-9]{4}`,
		ValueGroup: 0,
	}))
	require.NotEqual(t, before, PatternGeneration())

	found, _ := Detect("see MARK-2048 today")
	require.Len(t, found, 1)
	require.Equal(t, "MARK-2048", found[0].Value)
	require.Equal(t, "Mark", found[0].DisplayName)
	require.Equal(t, []string{owner + ":mark"}, found[0].TypeIDs)

	_, remote, err := Prepare(t.Context(), owner+":mark", "MARK-2048")
	require.NoError(t, err)
	require.Nil(t, remote)

	require.NoError(t, AddProvider(owner, &model.EntityProvider{
		Name:    "mark.card",
		Types:   []string{"mark"},
		HasCard: true,
	}))
	_, remote, err = Prepare(t.Context(), owner+":mark", "MARK-2048")
	require.NoError(t, err)
	require.Equal(t, Ref{Owner: owner, Name: "mark.card"}, remote.Provider)

	_, _, err = Prepare(t.Context(), owner+":mark", "MARK-2048-extra")
	require.Error(t, err)

	RemoveOwner(owner)
	found, _ = Detect("see MARK-2048 today")
	require.Empty(t, found)
	require.Equal(t, before, PatternGeneration())
}

func TestAcronymTermIsTheHoverAndTheLink(t *testing.T) {
	const owner = "com.example.glossary"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "acronym", DisplayName: "Acronym"}))
	before := PatternGeneration()
	epoch, changed, err := ReplaceTerms(owner, owner+":acronym", []model.EntityTerm{{
		Value: "MLT",
		Title: "Mattermost leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, before, PatternGeneration())
	next, changed, err := ReplaceTerms(owner, owner+":acronym", []model.EntityTerm{{
		Value: "MLT",
		Title: "Mattermost leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)
	require.False(t, changed)
	require.Equal(t, epoch, next)

	patterns, protected := Detect("ask the MLT today, not MLTs or `MLT`")
	require.Empty(t, patterns)
	entities := ApplyTerms("ask the MLT today, not MLTs or `MLT`", protected, patterns)
	require.Len(t, entities, 1)
	require.Equal(t, "MLT", entities[0].Value)
	require.Equal(t, "Acronym", entities[0].DisplayName)
	require.Equal(t, "Mattermost leadership team", entities[0].Title)
	require.Equal(t, "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz", entities[0].URL)

	card, remote, err := Prepare(t.Context(), owner+":acronym", "MLT")
	require.NoError(t, err)
	require.Nil(t, remote)
	require.Equal(t, "Mattermost leadership team", card.Summary)

	_, _, err = ReplaceTerms(owner, owner+":acronym", []model.EntityTerm{{
		Value: "A",
		Title: "Too short",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.Error(t, err)
	_, _, err = ReplaceTerms("com.example.other", owner+":acronym", nil)
	require.Error(t, err)
}

func TestProviderSelectsWhoTheCardIsCachedFor(t *testing.T) {
	const owner = "com.example.cards"
	t.Cleanup(func() { RemoveOwner(owner) })
	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:    "mark.scan",
		Type:    "mark",
		Pattern: `MARK-[0-9]{4}`,
	}))

	require.Error(t, AddProvider(owner, &model.EntityProvider{
		Name:    "mark.card",
		Types:   []string{"mark"},
		HasCard: true,
		Cache:   "session",
	}))
	require.Error(t, AddProvider(owner, &model.EntityProvider{
		Name:            "mark.card",
		Types:           []string{"mark"},
		HasCard:         true,
		Cache:           model.EntityCacheShared,
		CacheTTLSeconds: 24*60*60 + 1,
	}))

	require.NoError(t, AddProvider(owner, &model.EntityProvider{
		Name:            "mark.card",
		Types:           []string{"mark"},
		HasCard:         true,
		Cache:           model.EntityCacheUser,
		CacheTTLSeconds: 60,
	}))
	_, remote, err := Prepare(t.Context(), owner+":mark", "MARK-2048")
	require.NoError(t, err)
	require.Equal(t, model.EntityCacheUser, remote.Cache)
	require.Equal(t, 60*time.Second, remote.CacheTTL)

	shared, ok := CardCacheKey(remote.Provider.String(), model.EntityCacheShared, owner+":mark", "MARK-2048", "user-a", "post-1", 10)
	require.True(t, ok)
	again, _ := CardCacheKey(remote.Provider.String(), model.EntityCacheShared, owner+":mark", "MARK-2048", "user-b", "post-1", 10)
	require.Equal(t, shared, again)
	otherPost, _ := CardCacheKey(remote.Provider.String(), model.EntityCacheShared, owner+":mark", "MARK-2048", "user-a", "post-2", 10)
	require.NotEqual(t, shared, otherPost)
	otherTime, _ := CardCacheKey(remote.Provider.String(), model.EntityCacheShared, owner+":mark", "MARK-2048", "user-a", "post-1", 11)
	require.NotEqual(t, shared, otherTime)

	mine, ok := CardCacheKey(remote.Provider.String(), model.EntityCacheUser, owner+":mark", "MARK-2048", "user-a", "post-1", 10)
	require.True(t, ok)
	theirs, _ := CardCacheKey(remote.Provider.String(), model.EntityCacheUser, owner+":mark", "MARK-2048", "user-b", "post-1", 10)
	require.NotEqual(t, mine, theirs)
	require.NotEqual(t, shared, mine)

	_, ok = CardCacheKey(remote.Provider.String(), model.EntityCacheNone, owner+":mark", "MARK-2048", "user-a", "", 0)
	require.False(t, ok)
	_, ok = CardCacheKey(remote.Provider.String(), model.EntityCacheUser, owner+":mark", "MARK-2048", "", "", 0)
	require.False(t, ok)
}

func TestOwnerCannotUseAnotherOwnersType(t *testing.T) {
	t.Cleanup(func() { RemoveOwner("com.example.one"); RemoveOwner("com.example.two") })
	require.NoError(t, AddType("com.example.two", &model.EntityType{Name: "mark", DisplayName: "Mark"}))

	require.Error(t, AddMatcher("com.example.one", &model.EntityMatcher{
		Name:    "scan",
		Type:    "com.example.two:mark",
		Pattern: `MARK-[0-9]+`,
	}))
	require.Error(t, AddProvider("com.example.one", &model.EntityProvider{
		Name:  "card",
		Types: []string{"com.example.two:mark"},
	}))
	_, _, err := ReplaceTerms("com.example.one", "com.example.two:mark", nil)
	require.Error(t, err)
	require.Error(t, AddMatcher("com.example.one", &model.EntityMatcher{
		Name:    "scan",
		Type:    "mark",
		Pattern: `MARK-[0-9]+`,
	}), "a bare type name resolves to the caller's own types")
}

func TestNestedOwnersDoNotShareNames(t *testing.T) {
	t.Cleanup(func() { RemoveOwner("com.example"); RemoveOwner("com.example.security") })
	spec := &model.EntityMatcher{Name: "security.vuln", Type: "mm:time", Pattern: `CVE-[0-9]+`}
	require.NoError(t, AddMatcher("com.example", spec))
	require.NoError(t, AddMatcher("com.example.security", &model.EntityMatcher{Name: "security.vuln", Type: "mm:time", Pattern: `CVE-[0-9]+`}))
	require.NoError(t, AddProvider("com.example", &model.EntityProvider{Name: "card", Types: []string{"mm:time"}}))
	require.NoError(t, AddProvider("com.example.security", &model.EntityProvider{Name: "card", Types: []string{"mm:time"}}))

	reg.mu.RLock()
	defer reg.mu.RUnlock()
	parent, ok := reg.matcher("com.example:security.vuln")
	require.True(t, ok)
	assert.Equal(t, "com.example", parent.ref.Owner)
	child, ok := reg.matcher("com.example.security:security.vuln")
	require.True(t, ok)
	assert.Equal(t, "com.example.security", child.ref.Owner)
}

func TestNamesAndOwnersAreValidated(t *testing.T) {
	t.Cleanup(func() { RemoveOwner("my_plugin"); RemoveOwner("com.Example") })
	require.NoError(t, AddType("my_plugin", &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddType("com.Example", &model.EntityType{Name: "mark", DisplayName: "Mark"}))

	for _, name := range []string{"", "Mark", "a:b", "a..b", ".a", "a.", "a b"} {
		assert.Error(t, AddType("com.example", &model.EntityType{Name: name, DisplayName: "Bad"}), "name %q", name)
	}
	assert.Error(t, AddType("com:example", &model.EntityType{Name: "mark", DisplayName: "Bad"}))
	assert.Error(t, AddMatcher("com.example", &model.EntityMatcher{Name: "bad", Type: "mm:time", Pattern: `(`}))
}

func TestRefsRoundTrip(t *testing.T) {
	ref, ok := ParseRef("com.example.security:vuln.cve")
	require.True(t, ok)
	assert.Equal(t, Ref{Owner: "com.example.security", Name: "vuln.cve"}, ref)
	assert.Equal(t, "com.example.security:vuln.cve", ref.String())

	_, ok = ParseRef("com.example.vuln")
	assert.False(t, ok)

	resolved, ok := ResolveRef("com.example", "vuln")
	require.True(t, ok)
	assert.Equal(t, "com.example:vuln", resolved.String())
	resolved, ok = ResolveRef("com.example", "mm:time")
	require.True(t, ok)
	assert.Equal(t, "mm:time", resolved.String())

	assert.Equal(t, "vuln", LocalRef("com.example", "com.example:vuln"))
	assert.Equal(t, "mm:time", LocalRef("com.example", "mm:time"))
	assert.Equal(t, "com.example.security:vuln", LocalRef("com.example", "com.example.security:vuln"))
}

func TestValueGroupIgnoresParenthesesInsideClasses(t *testing.T) {
	const owner = "com.example.brackets"
	t.Cleanup(func() { RemoveOwner(owner) })
	typeID := owner + ":freq"
	require.NoError(t, AddType(owner, &model.EntityType{Name: "freq", DisplayName: "Frequency"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:       "freq",
		Type:       typeID,
		Pattern:    `FREQ:[(]([0-9]+)[)]`,
		ValueGroup: 1,
	}))
	found, _ := Detect("tune FREQ:(1234) now")
	require.Len(t, found, 1)
	require.Equal(t, "1234", found[0].Value)
}
