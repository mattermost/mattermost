// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
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
	t.Run("GetPolicyHistory", func(t *testing.T) { testAccessControlPolicyStoreGetPolicyHistory(t, rctx, ss) })
}

func testAccessControlPolicyStoreSaveAndGet(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save parent policy", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Name",
			Type:     model.AccessControlPolicyTypeParent,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
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
			Version:  model.AccessControlPolicyVersionV0_2,
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
			Version:  model.AccessControlPolicyVersionV0_2,
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
			Version:  model.AccessControlPolicyVersionV0_2,
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
			Version:  model.AccessControlPolicyVersionV0_2,
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
			Version:  model.AccessControlPolicyVersionV0_2,
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
		Version:  model.AccessControlPolicyVersionV0_2,
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
		Version:  model.AccessControlPolicyVersionV0_2,
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
		Version:  model.AccessControlPolicyVersionV0_2,
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
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{Limit: 10})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 3)
	})

	t.Run("GetAll by type", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{Type: model.AccessControlPolicyTypeParent, IncludeChildren: true, Limit: 10})
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

	t.Run("GetAll by IDs", func(t *testing.T) {
		// Test searching by specific IDs
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			IDs:   []string{parentPolicy.ID, resourcePolicy.ID},
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 2)

		// Verify we got the correct policies
		foundIDs := make([]string, len(policies))
		for i, p := range policies {
			foundIDs[i] = p.ID
		}
		require.Contains(t, foundIDs, parentPolicy.ID)
		require.Contains(t, foundIDs, resourcePolicy.ID)

		// Test searching by single ID
		policies, _, err = ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			IDs:   []string{parentPolicy.ID},
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 1)
		require.Equal(t, parentPolicy.ID, policies[0].ID)

		// Test searching by non-existent IDs
		policies, _, err = ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			IDs:   []string{model.NewId(), model.NewId()},
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 0)

		// Test combining IDs with Type filter
		policies, _, err = ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			IDs:   []string{parentPolicy.ID, resourcePolicy.ID},
			Type:  model.AccessControlPolicyTypeParent,
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 1)
		require.Equal(t, parentPolicy.ID, policies[0].ID)
	})
}

func testAccessControlPolicyStoreGetPolicyHistory(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should return empty slice for non-existent policy", func(t *testing.T) {
		policies, err := ss.AccessControlPolicy().GetPolicyHistory(rctx, model.NewId(), 10)
		require.NoError(t, err)
		require.Empty(t, policies)
	})

	t.Run("should validate input parameters", func(t *testing.T) {
		// Test empty ID
		_, err := ss.AccessControlPolicy().GetPolicyHistory(rctx, "", 10)
		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot be empty")

		// Test invalid ID format
		_, err = ss.AccessControlPolicy().GetPolicyHistory(rctx, "invalid-id-format", 10)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid policy ID format")
	})

	t.Run("should return empty history for newly created policy", func(t *testing.T) {
		policyID := model.NewId()
		newPolicy := &model.AccessControlPolicy{
			ID:      policyID,
			Name:    "New Policy",
			Type:    model.AccessControlPolicyTypeChannel,
			Active:  true,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Expression: "user.department == 'engineering'", Actions: []string{"*"}},
			},
			Props: make(map[string]any),
		}

		// Save new policy (first time)
		savedPolicy, err := ss.AccessControlPolicy().Save(rctx, newPolicy)
		require.NoError(t, err)
		require.NotNil(t, savedPolicy)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, policyID)
			require.NoError(t, deleteErr)
		})

		// Should have no history for newly created policy
		policies, err := ss.AccessControlPolicy().GetPolicyHistory(rctx, policyID, 10)
		require.NoError(t, err)
		require.Empty(t, policies) // No history entries yet
	})

	t.Run("should return policy history in descending revision order after updates", func(t *testing.T) {
		policyID := model.NewId()
		originalPolicy := &model.AccessControlPolicy{
			ID:      policyID,
			Name:    "Test Policy",
			Type:    model.AccessControlPolicyTypeChannel,
			Active:  true,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Expression: "user.department == 'engineering'", Actions: []string{"*"}},
			},
			Props: make(map[string]any),
		}

		// Save initial policy
		savedPolicy, err := ss.AccessControlPolicy().Save(rctx, originalPolicy)
		require.NoError(t, err)
		require.Equal(t, 1, savedPolicy.Revision)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, policyID)
			require.NoError(t, deleteErr)
		})

		// Update policy first time (moves original to history)
		updatedPolicy := *originalPolicy
		updatedPolicy.Rules = []model.AccessControlPolicyRule{
			{Expression: "user.department == 'sales'", Actions: []string{"*"}},
		}
		secondVersion, err := ss.AccessControlPolicy().Save(rctx, &updatedPolicy)
		require.NoError(t, err)
		require.Equal(t, 2, secondVersion.Revision)

		// Update policy second time (moves first update to history)
		updatedPolicy2 := updatedPolicy
		updatedPolicy2.Rules = []model.AccessControlPolicyRule{
			{Expression: "user.department == 'marketing'", Actions: []string{"*"}},
		}
		thirdVersion, err := ss.AccessControlPolicy().Save(rctx, &updatedPolicy2)
		require.NoError(t, err)
		require.Equal(t, 3, thirdVersion.Revision)

		// Get policy history - should return in DESC order by revision
		policies, err := ss.AccessControlPolicy().GetPolicyHistory(rctx, policyID, 10)
		require.NoError(t, err)
		require.Len(t, policies, 2) // Should have 2 history records (original + first update)

		// Verify ordering: most recent revision first
		require.Equal(t, 2, policies[0].Revision) // First update (sales)
		require.Equal(t, 1, policies[1].Revision) // Original (engineering)

		// Verify content
		require.Equal(t, "user.department == 'sales'", policies[0].Rules[0].Expression)
		require.Equal(t, "user.department == 'engineering'", policies[1].Rules[0].Expression)
	})

	t.Run("should respect limit parameter", func(t *testing.T) {
		policyID := model.NewId()
		originalPolicy := &model.AccessControlPolicy{
			ID:      policyID,
			Name:    "Limit Test Policy",
			Type:    model.AccessControlPolicyTypeChannel,
			Active:  true,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Expression: "user.department == 'engineering'", Actions: []string{"*"}},
			},
			Props: make(map[string]any),
		}

		// Create multiple revisions to test limit
		_, err := ss.AccessControlPolicy().Save(rctx, originalPolicy)
		require.NoError(t, err)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, policyID)
			require.NoError(t, deleteErr)
		})

		// Create 3 more updates (4 total revisions, 3 in history)
		for i := 1; i <= 3; i++ {
			updatedPolicy := *originalPolicy
			updatedPolicy.Rules = []model.AccessControlPolicyRule{
				{Expression: fmt.Sprintf("user.department == 'dept%d'", i), Actions: []string{"*"}},
			}
			_, saveErr := ss.AccessControlPolicy().Save(rctx, &updatedPolicy)
			require.NoError(t, saveErr)
		}

		// Test limit = 1
		policies, err := ss.AccessControlPolicy().GetPolicyHistory(rctx, policyID, 1)
		require.NoError(t, err)
		require.Len(t, policies, 1)               // Should only return 1 despite having 3 history entries
		require.Equal(t, 3, policies[0].Revision) // Most recent history entry

		// Test limit = 2
		policies, err = ss.AccessControlPolicy().GetPolicyHistory(rctx, policyID, 2)
		require.NoError(t, err)
		require.Len(t, policies, 2)
		require.Equal(t, 3, policies[0].Revision)
		require.Equal(t, 2, policies[1].Revision)

		// Test limit = 0 (should use default)
		policies, err = ss.AccessControlPolicy().GetPolicyHistory(rctx, policyID, 0)
		require.NoError(t, err)
		require.Len(t, policies, 3) // Should return all 3 history entries
	})
}
