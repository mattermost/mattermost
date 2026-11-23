// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestDynamicBadgeHits(t *testing.T) {
	const ownerA = "com.example.badges.a"
	const ownerB = "com.example.badges.b"
	t.Cleanup(func() {
		RemoveOwner(ownerA)
		RemoveOwner(ownerB)
	})

	require.NoError(t, AddType(ownerA, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(ownerA, &model.EntityMatcher{
		Name:         "mark.scan",
		Type:         "mark",
		Pattern:      `BADGE-[0-9]{4}`,
		DynamicBadge: true,
	}))
	require.NoError(t, AddMatcher(ownerA, &model.EntityMatcher{
		Name:    "mark.static",
		Type:    "mark",
		Pattern: `STATIC-[0-9]{4}`,
	}))
	require.NoError(t, AddType(ownerB, &model.EntityType{Name: "ticket", DisplayName: "Ticket"}))
	require.NoError(t, AddMatcher(ownerB, &model.EntityMatcher{
		Name:         "ticket.scan",
		Type:         "ticket",
		Pattern:      `TICKET-[0-9]{4}`,
		DynamicBadge: true,
	}))

	found, _ := Detect("see BADGE-1001 and BADGE-1001 again and TICKET-2002 and STATIC-3003")
	require.GreaterOrEqual(t, len(found), 3)

	list := append([]*model.PostEntity(nil), found...)
	list = append(list,
		nil,
		&model.PostEntity{MatcherID: ownerA + ":mark.scan", Value: ""},
		&model.PostEntity{MatcherID: "", Value: "BADGE-9999"},
		&model.PostEntity{MatcherID: ownerA + ":mark.scan", Value: "BADGE-1001", TypeIDs: []string{ownerA + ":mark"}},
	)

	hits := DynamicBadgeHits(list)
	require.NotNil(t, hits)
	require.Len(t, hits[ownerA], 1, "same type+value deduped for owner A")
	require.Len(t, hits[ownerB], 1)

	assert.Equal(t, model.EntityBadgeItem{
		Type:  LocalRef(ownerA, ownerA+":mark"),
		Value: "BADGE-1001",
	}, hits[ownerA][0])
	assert.Equal(t, "mark", hits[ownerA][0].Type)
	assert.Equal(t, model.EntityBadgeItem{
		Type:  LocalRef(ownerB, ownerB+":ticket"),
		Value: "TICKET-2002",
	}, hits[ownerB][0])

	t.Run("uses TypeIDs[0] when set", func(t *testing.T) {
		entity := &model.PostEntity{
			MatcherID: ownerA + ":mark.scan",
			Value:     "BADGE-7777",
			TypeIDs:   []string{ownerA + ":mark", "ignored"},
		}
		hits := DynamicBadgeHits([]*model.PostEntity{entity})
		require.Len(t, hits[ownerA], 1)
		assert.Equal(t, "mark", hits[ownerA][0].Type)
		assert.Equal(t, "BADGE-7777", hits[ownerA][0].Value)
	})

	t.Run("empty list returns nil", func(t *testing.T) {
		assert.Nil(t, DynamicBadgeHits(nil))
		assert.Nil(t, DynamicBadgeHits([]*model.PostEntity{}))
	})
}

func TestApplyBadges(t *testing.T) {
	const owner = "com.example.badges.apply"
	const other = "com.example.badges.other"
	t.Cleanup(func() {
		RemoveOwner(owner)
		RemoveOwner(other)
	})

	require.NoError(t, AddType(owner, &model.EntityType{Name: "mark", DisplayName: "Mark"}))
	require.NoError(t, AddMatcher(owner, &model.EntityMatcher{
		Name:         "mark.scan",
		Type:         "mark",
		Pattern:      `APPLY-[0-9]{4}`,
		DynamicBadge: true,
	}))
	require.NoError(t, AddType(other, &model.EntityType{Name: "mark", DisplayName: "Other Mark"}))
	require.NoError(t, AddMatcher(other, &model.EntityMatcher{
		Name:         "mark.scan",
		Type:         "mark",
		Pattern:      `OTHER-[0-9]{4}`,
		DynamicBadge: true,
	}))

	found, _ := Detect("APPLY-1001 and APPLY-2002 and OTHER-3003")
	require.Len(t, found, 3)

	items := []model.EntityBadgeItem{
		{Type: LocalRef(owner, owner+":mark"), Value: "APPLY-1001"},
		{Type: LocalRef(owner, owner+":mark"), Value: "APPLY-2002"},
	}
	valid := &model.EntityBadge{Text: "9.8", Color: model.EntityBadgeColorCritical}
	invalid := &model.EntityBadge{Text: "9.8", Icon: "shield-outline"}
	badges := []*model.EntityBadge{valid, invalid}

	ApplyBadges(found, owner, items, badges)

	require.NotNil(t, found[0].Badge)
	assert.Equal(t, "9.8", found[0].Badge.Text)
	assert.Equal(t, model.EntityBadgeColorCritical, found[0].Badge.Color)
	assert.Nil(t, found[1].Badge, "invalid badge discarded")
	assert.Nil(t, found[2].Badge, "wrong owner ignored")

	t.Run("local ref type strings", func(t *testing.T) {
		list := []*model.PostEntity{{
			MatcherID: owner + ":mark.scan",
			TypeIDs:   []string{owner + ":mark"},
			Value:     "APPLY-4004",
		}}
		ApplyBadges(list, owner, []model.EntityBadgeItem{
			{Type: "mark", Value: "APPLY-4004"},
		}, []*model.EntityBadge{{Icon: "shield-outline", Color: model.EntityBadgeColorHigh}})
		require.NotNil(t, list[0].Badge)
		assert.Equal(t, "shield-outline", list[0].Badge.Icon)
	})
}
