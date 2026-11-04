// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPluginMatcherIsDetectedAndRemoved(t *testing.T) {
	const pluginID = "com.example.marks"
	t.Cleanup(func() { RemovePlugin(pluginID) })

	before := PatternGeneration()
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:         pluginID + ".mark.scan",
		TypeID:     pluginID + ".mark",
		Pattern:    `MARK-[0-9]{4}`,
		ValueGroup: 0,
	}))
	require.NotEqual(t, before, PatternGeneration())

	found, _ := Detect("see MARK-2048 today")
	require.Len(t, found, 1)
	require.Equal(t, "MARK-2048", found[0].Value)
	require.Equal(t, "Mark", found[0].DisplayName)
	require.Equal(t, []string{pluginID + ".mark"}, found[0].TypeIDs)

	_, remote, err := Prepare(t.Context(), pluginID+".mark", "MARK-2048")
	require.NoError(t, err)
	require.Nil(t, remote)

	require.NoError(t, AddProvider(pluginID, &model.EntityProvider{
		ID:      pluginID + ".mark.card",
		TypeIDs: []string{pluginID + ".mark"},
		HasCard: true,
	}))
	_, remote, err = Prepare(t.Context(), pluginID+".mark", "MARK-2048")
	require.NoError(t, err)
	require.Equal(t, pluginID, remote.PluginID)

	_, _, err = Prepare(t.Context(), pluginID+".mark", "MARK-2048-extra")
	require.Error(t, err)

	RemovePlugin(pluginID)
	found, _ = Detect("see MARK-2048 today")
	require.Empty(t, found)
	require.Equal(t, before, PatternGeneration())
}

func TestAcronymTermIsTheHoverAndTheLink(t *testing.T) {
	const pluginID = "com.example.glossary"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".acronym", DisplayName: "Acronym"}))
	before := PatternGeneration()
	epoch, changed, err := ReplaceTerms(pluginID, pluginID+".acronym", []model.EntityTerm{{
		Value: "MLT",
		Title: "Mattermost leadership team",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, before, PatternGeneration())
	next, changed, err := ReplaceTerms(pluginID, pluginID+".acronym", []model.EntityTerm{{
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

	card, remote, err := Prepare(t.Context(), pluginID+".acronym", "MLT")
	require.NoError(t, err)
	require.Nil(t, remote)
	require.Equal(t, "Mattermost leadership team", card.Summary)

	_, _, err = ReplaceTerms(pluginID, pluginID+".acronym", []model.EntityTerm{{
		Value: "A",
		Title: "Too short",
		URL:   "/conflux/team/pages/abcdefghijklmnopqrstuvwxyz",
	}})
	require.Error(t, err)
	_, _, err = ReplaceTerms("com.example.other", pluginID+".acronym", nil)
	require.Error(t, err)
}

func TestProviderSelectsWhoTheCardIsCachedFor(t *testing.T) {
	const pluginID = "com.example.cards"
	t.Cleanup(func() { RemovePlugin(pluginID) })
	require.NoError(t, AddType(pluginID, &model.EntityType{ID: pluginID + ".mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(pluginID, &model.EntityMatcher{
		ID:      pluginID + ".mark.scan",
		TypeID:  pluginID + ".mark",
		Pattern: `MARK-[0-9]{4}`,
	}))

	require.Error(t, AddProvider(pluginID, &model.EntityProvider{
		ID:      pluginID + ".mark.card",
		TypeIDs: []string{pluginID + ".mark"},
		HasCard: true,
		Cache:   "session",
	}))
	require.Error(t, AddProvider(pluginID, &model.EntityProvider{
		ID:              pluginID + ".mark.card",
		TypeIDs:         []string{pluginID + ".mark"},
		HasCard:         true,
		Cache:           model.EntityCacheShared,
		CacheTTLSeconds: 24*60*60 + 1,
	}))

	require.NoError(t, AddProvider(pluginID, &model.EntityProvider{
		ID:              pluginID + ".mark.card",
		TypeIDs:         []string{pluginID + ".mark"},
		HasCard:         true,
		Cache:           model.EntityCacheUser,
		CacheTTLSeconds: 60,
	}))
	_, remote, err := Prepare(t.Context(), pluginID+".mark", "MARK-2048")
	require.NoError(t, err)
	require.Equal(t, model.EntityCacheUser, remote.Cache)
	require.Equal(t, 60*time.Second, remote.CacheTTL)

	shared, ok := CardCacheKey(remote.ProviderID, model.EntityCacheShared, pluginID+".mark", "MARK-2048", "user-a", "post-1", 10)
	require.True(t, ok)
	again, _ := CardCacheKey(remote.ProviderID, model.EntityCacheShared, pluginID+".mark", "MARK-2048", "user-b", "post-1", 10)
	require.Equal(t, shared, again)
	otherPost, _ := CardCacheKey(remote.ProviderID, model.EntityCacheShared, pluginID+".mark", "MARK-2048", "user-a", "post-2", 10)
	require.NotEqual(t, shared, otherPost)
	otherTime, _ := CardCacheKey(remote.ProviderID, model.EntityCacheShared, pluginID+".mark", "MARK-2048", "user-a", "post-1", 11)
	require.NotEqual(t, shared, otherTime)

	mine, ok := CardCacheKey(remote.ProviderID, model.EntityCacheUser, pluginID+".mark", "MARK-2048", "user-a", "post-1", 10)
	require.True(t, ok)
	theirs, _ := CardCacheKey(remote.ProviderID, model.EntityCacheUser, pluginID+".mark", "MARK-2048", "user-b", "post-1", 10)
	require.NotEqual(t, mine, theirs)
	require.NotEqual(t, shared, mine)

	_, ok = CardCacheKey(remote.ProviderID, model.EntityCacheNone, pluginID+".mark", "MARK-2048", "user-a", "", 0)
	require.False(t, ok)
	_, ok = CardCacheKey(remote.ProviderID, model.EntityCacheUser, pluginID+".mark", "MARK-2048", "", "", 0)
	require.False(t, ok)
}

func TestPluginCannotClaimAnotherPlugin(t *testing.T) {
	require.Error(t, AddType("com.example.one", &model.EntityType{ID: "com.example.two.mark", DisplayName: "Mark"}))
	require.Error(t, AddType("com.example", &model.EntityType{ID: "com.example.other.secret", DisplayName: "Secret"}))
	require.Error(t, AddMatcher("com.example.one", &model.EntityMatcher{
		ID:      "com.example.one.bad",
		TypeID:  "mm.vuln",
		Pattern: `(`,
	}))
	require.Error(t, AddMatcher("com.example.one", &model.EntityMatcher{
		ID:      "mm.vuln.cve",
		TypeID:  "mm.vuln",
		Pattern: `CVE-[0-9]{4}-[0-9]{4,7}`,
	}))
}
