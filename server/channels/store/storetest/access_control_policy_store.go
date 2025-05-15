// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

func TestAccessControlPolicyStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testAccessControlPolicyStoreSaveAndGet(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testAccessControlPolicyStoreDelete(t, rctx, ss) })
	t.Run("SetActive", func(t *testing.T) { testAccessControlPolicyStoreSetActive(t, rctx, ss) })
	t.Run("GetAll", func(t *testing.T) { testAccessControlPolicyStoreGetAll(t, rctx, ss) })
}

func testAccessControlPolicyStoreSaveAndGet(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save parent policy", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Name",
			Type:     model.AccessControlPolicyTypeParent,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "user.properties.program == \"engineering\"",
				},
			},
		}

		policy, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)

		t.Cleanup(func() {
			err := ss.AccessControlPolicy().Delete(rctx, policy.ID)
			require.NoError(t, err)
		})
	})

	t.Run("Save resource policy", func(t *testing.T) {
		parent1 := model.NewId()

		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Name",
			Type:     model.AccessControlPolicyTypeChannel,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Imports:  []string{parent1},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "policies." + parent1 + " ==  true",
				},
			},
		}

		policy, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)

		t.Cleanup(func() {
			err := ss.AccessControlPolicy().Delete(rctx, policy.ID)
			require.NoError(t, err)
		})
	})

	t.Run("update resource policy", func(t *testing.T) {
		policyID := model.NewId()

		policy := &model.AccessControlPolicy{
			ID:       policyID,
			Name:     "Name",
			Type:     model.AccessControlPolicyTypeChannel,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "user.properties.program == \"engineering\"",
				},
			},
		}

		policy, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)

		policy.Rules = []model.AccessControlPolicyRule{
			{
				Actions:    []string{"action"},
				Expression: "user.properties.program == \"engineering\" || user.properties.department == \"engineering\"",
			},
		}

		policy, err = ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)

		policy, err = ss.AccessControlPolicy().Get(rctx, policyID)
		require.NoError(t, err)
		require.NotNil(t, policy)
		require.Equal(t, 2, policy.Revision)

		t.Cleanup(func() {
			err := ss.AccessControlPolicy().Delete(rctx, policy.ID)
			require.NoError(t, err)
		})
	})

	t.Run("Get non-existent policy", func(t *testing.T) {
		id := model.NewId()
		policy, err := ss.AccessControlPolicy().Get(rctx, id)
		require.EqualError(t, err, store.NewErrNotFound("AccessControlPolicy", id).Error())
		require.Nil(t, policy)
	})
}

func testAccessControlPolicyStoreDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Delete parent policy", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Name",
			Type:     model.AccessControlPolicyTypeParent,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "user.properties.program == \"engineering\"",
				},
			},
		}

		policy, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)

		err = ss.AccessControlPolicy().Delete(rctx, policy.ID)
		require.NoError(t, err)

		id := policy.ID
		policy, err = ss.AccessControlPolicy().Get(rctx, policy.ID)
		require.EqualError(t, err, store.NewErrNotFound("AccessControlPolicy", id).Error())
		require.Nil(t, policy)
	})

	t.Run("Delete resource policy", func(t *testing.T) {
		parent1 := model.NewId()

		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Name",
			Type:     model.AccessControlPolicyTypeChannel,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Imports:  []string{parent1},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "policies." + parent1 + " ==  true",
				},
			},
		}

		policy, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)

		err = ss.AccessControlPolicy().Delete(rctx, policy.ID)
		require.NoError(t, err)

		id := policy.ID
		policy, err = ss.AccessControlPolicy().Get(rctx, policy.ID)
		require.EqualError(t, err, store.NewErrNotFound("AccessControlPolicy", id).Error())
		require.Nil(t, policy)
	})

	t.Run("Delete non-existent policy", func(t *testing.T) {
		err := ss.AccessControlPolicy().Delete(rctx, model.NewId())
		require.NoError(t, err)
	})
}

func testAccessControlPolicyStoreSetActive(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save policy", func(t *testing.T) {
		id := model.NewId()
		policy := &model.AccessControlPolicy{
			ID:       id,
			Name:     "Name",
			Type:     model.AccessControlPolicyTypeChannel,
			Active:   false,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "user.properties.program == \"engineering\"",
				},
			},
		}

		policy, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)

		t.Cleanup(func() {
			err = ss.AccessControlPolicy().Delete(rctx, id)
			require.NoError(t, err)
		})

		policy, err = ss.AccessControlPolicy().Get(rctx, policy.ID)
		require.NoError(t, err)
		require.NotNil(t, policy)
		require.False(t, policy.Active)

		policy, err = ss.AccessControlPolicy().SetActiveStatus(rctx, policy.ID, true)
		require.NoError(t, err)
		require.NotNil(t, policy)
		require.True(t, policy.Active)

		policy, err = ss.AccessControlPolicy().Get(rctx, policy.ID)
		require.NoError(t, err)
		require.NotNil(t, policy)
		require.True(t, policy.Active)
	})
}

func testAccessControlPolicyStoreGetAll(t *testing.T, rctx request.CTX, ss store.Store) {
	id := model.NewId()
	parentPolicy := &model.AccessControlPolicy{
		ID:       id,
		Name:     "Name",
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Imports:  []string{},
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"action"},
				Expression: "user.properties.program == \"engineering\"",
			},
		},
	}
	t.Cleanup(func() {
		err := ss.AccessControlPolicy().Delete(rctx, id)
		require.NoError(t, err)
	})

	parentPolicy, err := ss.AccessControlPolicy().Save(rctx, parentPolicy)
	require.NoError(t, err)
	require.NotNil(t, parentPolicy)

	id2 := model.NewId()
	resourcePolicy := &model.AccessControlPolicy{
		ID:       id2,
		Name:     "Name",
		Type:     model.AccessControlPolicyTypeChannel,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Imports:  []string{parentPolicy.ID},
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"action"},
				Expression: "policies." + parentPolicy.ID + " ==  true",
			},
		},
	}
	t.Cleanup(func() {
		err = ss.AccessControlPolicy().Delete(rctx, id2)
		require.NoError(t, err)
	})

	id3 := "zzz" + model.NewId()[3:] // ensure the order of the ID
	parentPolicy2 := &model.AccessControlPolicy{
		ID:       id3,
		Name:     "Name",
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Imports:  []string{},
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"action"},
				Expression: "user.properties.program == \"engineering\"",
			},
		},
	}
	t.Cleanup(func() {
		err = ss.AccessControlPolicy().Delete(rctx, id)
		require.NoError(t, err)
	})

	_, err = ss.AccessControlPolicy().Save(rctx, parentPolicy2)
	require.NoError(t, err)
	require.NotNil(t, parentPolicy)

	resourcePolicy, err = ss.AccessControlPolicy().Save(rctx, resourcePolicy)
	require.NoError(t, err)
	require.NotNil(t, resourcePolicy)
	t.Run("GetAll", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 3)
	})

	t.Run("GetAll by type", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{Type: model.AccessControlPolicyTypeParent, IncludeChildren: true})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 2)
		require.Equal(t, parentPolicy.ID, policies[0].ID)
		require.Equal(t, map[string]any{"child_ids": []string{resourcePolicy.ID}}, policies[0].Props)
		require.Equal(t, map[string]any{"child_ids": []string{}}, policies[1].Props)

		policies, _, err = ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{Type: model.AccessControlPolicyTypeChannel})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 1)
		require.Equal(t, resourcePolicy.ID, policies[0].ID)
	})

	t.Run("GetAll by parent", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{ParentID: parentPolicy.ID})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 1)
		require.Equal(t, resourcePolicy.ID, policies[0].ID)

		policies, _, err = ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{ParentID: model.NewId()})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 0)
	})
}
