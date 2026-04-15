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
	t.Run("SaveDuplicateName", func(t *testing.T) { testAccessControlPolicyStoreSaveDuplicateName(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testAccessControlPolicyStoreDelete(t, rctx, ss) })
	t.Run("SetActive", func(t *testing.T) { testAccessControlPolicyStoreSetActive(t, rctx, ss) })
	t.Run("SetActiveMultiple", func(t *testing.T) { testAccessControlPolicyStoreSetActiveMultiple(t, rctx, ss) })
	t.Run("GetAll", func(t *testing.T) { testAccessControlPolicyStoreGetAll(t, rctx, ss) })
	t.Run("Search", func(t *testing.T) { testAccessControlPolicyStoreSearch(t, rctx, ss) })
	t.Run("SearchByActions", func(t *testing.T) { testAccessControlPolicyStoreSearchByActions(t, rctx, ss) })
	t.Run("GetPoliciesByFieldID", func(t *testing.T) { testAccessControlPolicyStoreGetPoliciesByFieldID(t, rctx, ss) })
}

func testAccessControlPolicyStoreSaveAndGet(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save parent policy", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Save Parent " + model.NewId(),
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

func testAccessControlPolicyStoreSaveDuplicateName(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Duplicate parent policy name should fail", func(t *testing.T) {
		policy1 := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Unique Policy Name",
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

		policy1, err := ss.AccessControlPolicy().Save(rctx, policy1)
		require.NoError(t, err)
		require.NotNil(t, policy1)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, policy1.ID)
			require.NoError(t, deleteErr)
		})

		policy2 := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Unique Policy Name",
			Type:     model.AccessControlPolicyTypeParent,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "user.properties.department == \"sales\"",
				},
			},
		}

		_, err = ss.AccessControlPolicy().Save(rctx, policy2)
		require.Error(t, err)
		var conflictErr *store.ErrConflict
		require.ErrorAs(t, err, &conflictErr)
	})

	t.Run("Same name across different types should succeed", func(t *testing.T) {
		parentPolicy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Cross Type Name",
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

		parentPolicy, err := ss.AccessControlPolicy().Save(rctx, parentPolicy)
		require.NoError(t, err)
		require.NotNil(t, parentPolicy)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, parentPolicy.ID)
			require.NoError(t, deleteErr)
		})

		channelPolicy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Cross Type Name",
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

		channelPolicy, err = ss.AccessControlPolicy().Save(rctx, channelPolicy)
		require.NoError(t, err)
		require.NotNil(t, channelPolicy)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, channelPolicy.ID)
			require.NoError(t, deleteErr)
		})
	})

	t.Run("Updating same policy name should succeed", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Update Same Name",
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
		require.Equal(t, 1, policy.Revision)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, policy.ID)
			require.NoError(t, deleteErr)
		})

		// Update rules but keep same name — should succeed and bump revision
		policy.Rules = []model.AccessControlPolicyRule{
			{
				Actions:    []string{"action"},
				Expression: "user.properties.department == \"sales\"",
			},
		}

		policy, err = ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)
		require.Equal(t, 2, policy.Revision)
	})

	t.Run("Changing policy name should not bump revision", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Original Name",
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
		require.Equal(t, 1, policy.Revision)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, policy.ID)
			require.NoError(t, deleteErr)
		})

		// Change only the name — revision should NOT bump
		policy.Name = "Renamed Policy"

		policy, err = ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		require.NotNil(t, policy)
		require.Equal(t, "Renamed Policy", policy.Name)
		require.Equal(t, 1, policy.Revision)

		// Verify the name persisted
		fetched, err := ss.AccessControlPolicy().Get(rctx, policy.ID)
		require.NoError(t, err)
		require.Equal(t, "Renamed Policy", fetched.Name)
		require.Equal(t, 1, fetched.Revision)
	})

	t.Run("Reusing name after deletion should succeed", func(t *testing.T) {
		policy1 := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Reusable Name",
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

		policy1, err := ss.AccessControlPolicy().Save(rctx, policy1)
		require.NoError(t, err)

		err = ss.AccessControlPolicy().Delete(rctx, policy1.ID)
		require.NoError(t, err)

		policy2 := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Reusable Name",
			Type:     model.AccessControlPolicyTypeParent,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action"},
					Expression: "user.properties.department == \"sales\"",
				},
			},
		}

		policy2, err = ss.AccessControlPolicy().Save(rctx, policy2)
		require.NoError(t, err)
		require.NotNil(t, policy2)

		t.Cleanup(func() {
			deleteErr := ss.AccessControlPolicy().Delete(rctx, policy2.ID)
			require.NoError(t, deleteErr)
		})
	})
}

func testAccessControlPolicyStoreDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Delete parent policy", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Delete Parent " + model.NewId(),
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
		Name:     "GetAll Parent " + id,
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
		Name:     "Name2",
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
		err = ss.AccessControlPolicy().Delete(rctx, id3)
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

func testAccessControlPolicyStoreSearch(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("ensure paging works fine", func(t *testing.T) {
		ids := make([]string, 0, 15)
		// Create 15 policies
		for i := range 15 {
			policy := &model.AccessControlPolicy{
				ID:       model.NewId(),
				Name:     "Policy " + string(rune('A'+i)),
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
			ids = append(ids, policy.ID)
		}

		t.Cleanup(func() {
			// Clean up created policies
			for _, id := range ids {
				err := ss.AccessControlPolicy().Delete(rctx, id)
				require.NoError(t, err)
			}
		})

		// firt page should get 10
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 10)

		// second page should get only 5
		policies, _, err = ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Limit: 10,
			Cursor: model.AccessControlPolicyCursor{
				ID: policies[len(policies)-1].ID,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 5)

		// should get all 15 when no paging
		policies, _, err = ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Limit: 20,
		})
		require.NoError(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 15)
	})
}

func testAccessControlPolicyStoreSearchByActions(t *testing.T, rctx request.CTX, ss store.Store) {
	membershipOnly := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "MembershipOnly " + model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.AccessControlPolicyActionMembership},
			Expression: "true",
		}},
	}
	uploadOnly := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "UploadOnly " + model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.AccessControlPolicyActionUploadFileAttachment},
			Expression: "true",
		}},
	}
	multiAction := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "Multi " + model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{model.AccessControlPolicyActionMembership},
				Expression: "true",
			},
			{
				Actions:    []string{model.AccessControlPolicyActionDownloadFileAttachment},
				Expression: "true",
			},
		},
	}
	multiActionSingleRule := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "MultiSingleRule " + model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Rules: []model.AccessControlPolicyRule{{
			Actions: []string{
				model.AccessControlPolicyActionMembership,
				model.AccessControlPolicyActionDownloadFileAttachment,
			},
			Expression: "true",
		}},
	}

	for _, p := range []*model.AccessControlPolicy{membershipOnly, uploadOnly, multiAction, multiActionSingleRule} {
		saved, err := ss.AccessControlPolicy().Save(rctx, p)
		require.NoError(t, err)
		require.NotNil(t, saved)
	}
	t.Cleanup(func() {
		for _, p := range []*model.AccessControlPolicy{membershipOnly, uploadOnly, multiAction, multiActionSingleRule} {
			_ = ss.AccessControlPolicy().Delete(rctx, p.ID)
		}
	})

	t.Run("single action filter returns matching policies", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Actions: []string{model.AccessControlPolicyActionMembership},
			Limit:   10,
		})
		require.NoError(t, err)
		ids := make([]string, len(policies))
		for i, p := range policies {
			ids[i] = p.ID
		}
		require.Contains(t, ids, membershipOnly.ID)
		require.Contains(t, ids, multiAction.ID)
		require.Contains(t, ids, multiActionSingleRule.ID)
		require.NotContains(t, ids, uploadOnly.ID)
	})

	t.Run("upload action filter", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Actions: []string{model.AccessControlPolicyActionUploadFileAttachment},
			Limit:   10,
		})
		require.NoError(t, err)
		ids := make([]string, len(policies))
		for i, p := range policies {
			ids[i] = p.ID
		}
		require.Contains(t, ids, uploadOnly.ID)
		require.NotContains(t, ids, membershipOnly.ID)
		require.NotContains(t, ids, multiAction.ID)
		require.NotContains(t, ids, multiActionSingleRule.ID)
	})

	t.Run("multiple actions OR semantics", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Actions: []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment},
			Limit:   10,
		})
		require.NoError(t, err)
		ids := make([]string, len(policies))
		for i, p := range policies {
			ids[i] = p.ID
		}
		require.Contains(t, ids, uploadOnly.ID)
		require.Contains(t, ids, multiAction.ID)
		require.Contains(t, ids, multiActionSingleRule.ID)
		require.NotContains(t, ids, membershipOnly.ID)
	})

	t.Run("non-existent action returns nothing from scoped set", func(t *testing.T) {
		policies, _, err := ss.AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Actions: []string{"nonexistent_action"},
			Limit:   10,
		})
		require.NoError(t, err)
		require.Len(t, policies, 0)
	})
}

func testAccessControlPolicyStoreSetActiveMultiple(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Set active status for multiple policies", func(t *testing.T) {
		policy1 := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Policy1",
			Type:     model.AccessControlPolicyTypeChannel,
			Active:   false,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action1"},
					Expression: "user.properties.program == \"engineering\"",
				},
			},
		}

		policy2 := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Policy2",
			Type:     model.AccessControlPolicyTypeParent,
			Active:   false,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"action2"},
					Expression: "user.properties.department == \"sales\"",
				},
			},
		}

		policy1, err := ss.AccessControlPolicy().Save(rctx, policy1)
		require.NoError(t, err)
		require.NotNil(t, policy1)

		policy2, err = ss.AccessControlPolicy().Save(rctx, policy2)
		require.NoError(t, err)
		require.NotNil(t, policy2)

		t.Cleanup(func() {
			err = ss.AccessControlPolicy().Delete(rctx, policy1.ID)
			require.NoError(t, err)
			err = ss.AccessControlPolicy().Delete(rctx, policy2.ID)
			require.NoError(t, err)
		})

		updates := []model.AccessControlPolicyActiveUpdate{
			{ID: policy1.ID, Active: true},
			{ID: policy2.ID, Active: true},
		}

		updatedPolicies, err := ss.AccessControlPolicy().SetActiveStatusMultiple(rctx, updates)
		require.NoError(t, err)
		require.Len(t, updatedPolicies, 2)

		for _, p := range updatedPolicies {
			require.True(t, p.Active)
		}

		p1, err := ss.AccessControlPolicy().Get(rctx, policy1.ID)
		require.NoError(t, err)
		require.NotNil(t, p1)
		require.True(t, p1.Active)

		p2, err := ss.AccessControlPolicy().Get(rctx, policy2.ID)
		require.NoError(t, err)
		require.NotNil(t, p2)
		require.True(t, p2.Active)
	})
}

func testAccessControlPolicyStoreGetPoliciesByFieldID(t *testing.T, rctx request.CTX, ss store.Store) {
	fieldA := model.NewId()
	fieldB := model.NewId()

	makePolicy := func(t *testing.T, expression string) *model.AccessControlPolicy {
		t.Helper()
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Policy " + model.NewId(),
			Type:     model.AccessControlPolicyTypeParent,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: expression,
				},
			},
		}
		saved, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = ss.AccessControlPolicy().Delete(rctx, saved.ID)
		})
		return saved
	}

	t.Run("Single policy matches", func(t *testing.T) {
		p := makePolicy(t, fmt.Sprintf("user.attributes.id_%s == \"Engineering\"", fieldA))

		policies, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, fieldA)
		require.NoError(t, err)
		require.Len(t, policies, 1)
		require.Equal(t, p.ID, policies[0].ID)
	})

	t.Run("Multiple policies match same field", func(t *testing.T) {
		sharedField := model.NewId()
		p1 := makePolicy(t, fmt.Sprintf("user.attributes.id_%s == \"Engineering\"", sharedField))
		p2 := makePolicy(t, fmt.Sprintf("user.attributes.id_%s == \"Sales\"", sharedField))

		policies, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, sharedField)
		require.NoError(t, err)
		require.Len(t, policies, 2)

		ids := []string{policies[0].ID, policies[1].ID}
		require.Contains(t, ids, p1.ID)
		require.Contains(t, ids, p2.ID)
	})

	t.Run("No policies match", func(t *testing.T) {
		policies, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, model.NewId())
		require.NoError(t, err)
		require.Empty(t, policies)
	})

	t.Run("Multiple fields in one expression", func(t *testing.T) {
		expr := fmt.Sprintf("user.attributes.id_%s == \"x\" && user.attributes.id_%s == \"y\"", fieldA, fieldB)
		makePolicy(t, expr)

		policiesA, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, fieldA)
		require.NoError(t, err)
		require.Len(t, policiesA, 1)

		policiesB, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, fieldB)
		require.NoError(t, err)
		require.Len(t, policiesB, 1)

		unusedField := model.NewId()
		policiesC, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, unusedField)
		require.NoError(t, err)
		require.Empty(t, policiesC)
	})

	t.Run("Field removed after policy update", func(t *testing.T) {
		updatableField := model.NewId()
		replacementField := model.NewId()

		p := makePolicy(t, fmt.Sprintf("user.attributes.id_%s == \"v1\"", updatableField))

		policies, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, updatableField)
		require.NoError(t, err)
		require.Len(t, policies, 1)

		p.Rules = []model.AccessControlPolicyRule{
			{
				Actions:    []string{"*"},
				Expression: fmt.Sprintf("user.attributes.id_%s == \"v2\"", replacementField),
			},
		}
		_, err = ss.AccessControlPolicy().Save(rctx, p)
		require.NoError(t, err)

		policies, err = ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, updatableField)
		require.NoError(t, err)
		require.Empty(t, policies)

		policies, err = ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, replacementField)
		require.NoError(t, err)
		require.Len(t, policies, 1)
	})

	t.Run("Deleted policy no longer matches", func(t *testing.T) {
		deletableField := model.NewId()
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Policy " + model.NewId(),
			Type:     model.AccessControlPolicyTypeParent,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: fmt.Sprintf("user.attributes.id_%s == \"test\"", deletableField),
				},
			},
		}
		saved, err := ss.AccessControlPolicy().Save(rctx, policy)
		require.NoError(t, err)

		policies, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, deletableField)
		require.NoError(t, err)
		require.Len(t, policies, 1)

		err = ss.AccessControlPolicy().Delete(rctx, saved.ID)
		require.NoError(t, err)

		policies, err = ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, deletableField)
		require.NoError(t, err)
		require.Empty(t, policies)
	})

	t.Run("Invalid field ID returns error", func(t *testing.T) {
		policies, err := ss.AccessControlPolicy().GetPoliciesByFieldID(rctx, "invalid")
		require.Error(t, err)
		require.Nil(t, policies)
	})
}
