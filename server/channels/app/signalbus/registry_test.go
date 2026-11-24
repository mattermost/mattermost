// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

func createItemAction() model.ActionDescriptor {
	return model.ActionDescriptor{
		Type:    "create_item",
		Label:   "Create item",
		Fields:  []model.SignalField{{Key: "title"}},
		Results: []model.SignalField{{Key: "item_id"}},
	}
}

func TestRegistry(t *testing.T) {
	t.Run("the server sets the publisher ID", func(t *testing.T) {
		tb := newTestBus(t, 0)
		require.NoError(t, tb.RegisterGroup(publisherID, model.SignalGroup{PublisherID: "spoofed", Name: "items", Label: "Items"}))
		signal := itemSignal("item_created", "items")
		signal.PublisherID = "spoofed"
		require.NoError(t, tb.RegisterSignal(publisherID, signal))
		action := createItemAction()
		action.PublisherID = "spoofed"
		require.NoError(t, tb.RegisterAction(publisherID, action))

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		require.Len(t, catalog.Groups, 1)
		require.Len(t, catalog.Signals, 1)
		require.Len(t, catalog.Actions, 1)
		assert.Equal(t, publisherID, catalog.Groups[0].PublisherID)
		assert.Equal(t, publisherID, catalog.Signals[0].PublisherID)
		assert.Equal(t, publisherID, catalog.Actions[0].PublisherID)
	})

	t.Run("an inactive plugin can't register groups or signals", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.hooks.setInactive(publisherID, true)
		err := tb.RegisterGroup(publisherID, model.SignalGroup{Name: "items", Label: "Items"})
		require.ErrorIs(t, err, model.ErrPluginNotActive)
		err = tb.RegisterSignal(publisherID, itemSignal("item_created", ""))
		require.ErrorIs(t, err, model.ErrPluginNotActive)

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		assert.Empty(t, catalog.Groups)
		assert.Empty(t, catalog.Signals)
	})

	t.Run("re-registering replaces the entry", func(t *testing.T) {
		tb := newTestBus(t, 0)
		require.NoError(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "items", Label: "Items"}))
		require.NoError(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "items", Label: "Things"}))

		first := itemSignal("item_created", "")
		require.NoError(t, tb.RegisterSignal(publisherID, first))
		second := itemSignal("item_created", "")
		second.Version = 2
		second.Label = "Item created v2"
		require.NoError(t, tb.RegisterSignal(publisherID, second))

		require.NoError(t, tb.RegisterAction(publisherID, createItemAction()))
		replaced := createItemAction()
		replaced.Label = "Create a new item"
		require.NoError(t, tb.RegisterAction(publisherID, replaced))

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		require.Len(t, catalog.Groups, 1)
		assert.Equal(t, "Things", catalog.Groups[0].Label)
		require.Len(t, catalog.Signals, 1)
		assert.Equal(t, 2, catalog.Signals[0].Version)
		assert.Equal(t, "Item created v2", catalog.Signals[0].Label)
		require.Len(t, catalog.Actions, 1)
		assert.Equal(t, "Create a new item", catalog.Actions[0].Label)
	})

	t.Run("a group must be registered first by the same publisher", func(t *testing.T) {
		tb := newTestBus(t, 0)
		require.ErrorIs(t, tb.RegisterSignal(publisherID, itemSignal("item_created", "items")), model.ErrSignalGroupNotRegistered)

		require.NoError(t, tb.RegisterGroup(publisher2ID, model.SignalGroup{Name: "items", Label: "Items"}))
		require.ErrorIs(t, tb.RegisterSignal(publisherID, itemSignal("item_created", "items")), model.ErrSignalGroupNotRegistered)

		action := createItemAction()
		action.Group = "items"
		require.ErrorIs(t, tb.RegisterAction(publisherID, action), model.ErrSignalGroupNotRegistered)

		require.NoError(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "items", Label: "Items"}))
		require.NoError(t, tb.RegisterSignal(publisherID, itemSignal("item_created", "items")))
		require.NoError(t, tb.RegisterAction(publisherID, action))
	})

	t.Run("invalid descriptors are rejected", func(t *testing.T) {
		tb := newTestBus(t, 0)
		require.ErrorIs(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "Bad"}), model.ErrSignalDescriptorInvalid)
		require.ErrorIs(t, tb.RegisterSignal(publisherID, model.SignalDescriptor{Name: "x", Label: "x"}), model.ErrSignalDescriptorInvalid)
		require.ErrorIs(t, tb.RegisterAction(publisherID, model.ActionDescriptor{Type: "x"}), model.ErrSignalDescriptorInvalid)
	})

	t.Run("registering an action requires OnActionCall", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.hooks.setMissingHook(publisherID, plugin.OnActionCallID)
		require.ErrorIs(t, tb.RegisterAction(publisherID, createItemAction()), model.ErrActionHookMissing)
	})

	t.Run("the registry keeps its own copy of the descriptor", func(t *testing.T) {
		tb := newTestBus(t, 0)
		signal := itemSignal("item_created", "")
		require.NoError(t, tb.RegisterSignal(publisherID, signal))
		signal.Fields[0].Key = "changed"

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		assert.Equal(t, "item_id", catalog.Signals[0].Fields[0].Key)

		catalog.Signals[0].Fields[0].Key = "changed_again"
		again, err := tb.Catalog()
		require.NoError(t, err)
		assert.Equal(t, "item_id", again.Signals[0].Fields[0].Key)
	})
}

func TestCatalog(t *testing.T) {
	register := func(t *testing.T, tb *testBus, reverse bool) {
		steps := []func(){
			func() { require.NoError(t, tb.RegisterGroup(publisher2ID, model.SignalGroup{Name: "b", Label: "B"})) },
			func() { require.NoError(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "z", Label: "Z"})) },
			func() { require.NoError(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "a", Label: "A"})) },
			func() { require.NoError(t, tb.RegisterSignal(publisher2ID, itemSignal("one", ""))) },
			func() { require.NoError(t, tb.RegisterSignal(publisherID, itemSignal("beta", "z"))) },
			func() { require.NoError(t, tb.RegisterSignal(publisherID, itemSignal("alpha", "z"))) },
			func() { require.NoError(t, tb.RegisterSignal(publisherID, itemSignal("gamma", "a"))) },
			func() { require.NoError(t, tb.RegisterSignal(publisherID, itemSignal("ungrouped", ""))) },
			func() {
				a := createItemAction()
				a.Type = "zz"
				require.NoError(t, tb.RegisterAction(publisherID, a))
			},
			func() {
				a := createItemAction()
				a.Type = "aa"
				a.Group = "z"
				require.NoError(t, tb.RegisterAction(publisherID, a))
			},
			func() { require.NoError(t, tb.RegisterAction(publisher2ID, createItemAction())) },
		}
		if reverse {
			// Groups must still come before the entries that name them.
			rest := slices.Clone(steps[3:])
			slices.Reverse(rest)
			steps = append(slices.Clone(steps[:3]), rest...)
		}
		for _, step := range steps {
			step()
		}
	}

	tb := newTestBus(t, 0)
	register(t, tb, false)
	catalog, err := tb.Catalog()
	require.NoError(t, err)

	groupKeys := []string{}
	for _, g := range catalog.Groups {
		groupKeys = append(groupKeys, g.PublisherID+"/"+g.Name)
	}
	assert.Equal(t, []string{publisherID + "/a", publisherID + "/z", publisher2ID + "/b"}, groupKeys)

	signalKeys := []string{}
	for _, s := range catalog.Signals {
		signalKeys = append(signalKeys, s.PublisherID+"/"+s.Group+"/"+s.Name)
	}
	assert.Equal(t, []string{
		publisherID + "//ungrouped",
		publisherID + "/a/gamma",
		publisherID + "/z/alpha",
		publisherID + "/z/beta",
		publisher2ID + "//one",
	}, signalKeys)

	actionKeys := []string{}
	for _, a := range catalog.Actions {
		actionKeys = append(actionKeys, a.PublisherID+"/"+a.Group+"/"+a.Type)
	}
	assert.Equal(t, []string{publisherID + "//zz", publisherID + "/z/aa", publisher2ID + "//create_item"}, actionKeys)

	t.Run("hash is a stable SHA-256", func(t *testing.T) {
		assert.Len(t, catalog.Hash, 64)
		again, err := tb.Catalog()
		require.NoError(t, err)
		assert.Equal(t, catalog.Hash, again.Hash)
	})

	t.Run("hash does not depend on registration order", func(t *testing.T) {
		other := newTestBus(t, 0)
		register(t, other, true)
		otherCatalog, err := other.Catalog()
		require.NoError(t, err)
		assert.Equal(t, catalog.Hash, otherCatalog.Hash)
	})

	t.Run("hash changes when an entry changes in place", func(t *testing.T) {
		relabeled := newTestBus(t, 0)
		register(t, relabeled, false)
		signal, ok := relabeled.registry.signal(publisherID, "alpha")
		require.True(t, ok)
		signal.Label = "Renamed"
		require.NoError(t, relabeled.RegisterSignal(publisherID, signal))

		changed, err := relabeled.Catalog()
		require.NoError(t, err)
		require.Len(t, changed.Signals, len(catalog.Signals))
		assert.NotEqual(t, catalog.Hash, changed.Hash)
	})

	t.Run("hash changes with the contents", func(t *testing.T) {
		require.NoError(t, tb.RegisterSignal(publisherID, itemSignal("delta", "")))
		changed, err := tb.Catalog()
		require.NoError(t, err)
		assert.NotEqual(t, catalog.Hash, changed.Hash)
	})

	t.Run("empty catalog has empty lists", func(t *testing.T) {
		empty, err := newTestBus(t, 0).Catalog()
		require.NoError(t, err)
		assert.NotNil(t, empty.Groups)
		assert.NotNil(t, empty.Signals)
		assert.NotNil(t, empty.Actions)
		assert.Len(t, empty.Hash, 64)
	})
}
