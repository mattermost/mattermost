// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestLegacyEchoesUnderProductionHooks writes back what a legacy caller read,
// through the access_control group's production hooks. The owner sanitizer
// runs only there, so the stub hook other tests use can't see what it changes.
func TestLegacyEchoesUnderProductionHooks(t *testing.T) {
	th := Setup(t)
	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.AccessControlPropertyGroupName, Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)
	th.CPAGroupID = group.ID

	adminID := model.NewId()
	installed := map[string]bool{"plugin-src": true, "plugin-owner": true}
	pluginChecker := func(id string) bool { return installed[id] }
	ladder := func(rctx request.CTX, userID string, field *model.PropertyField, action, valueTargetID string) bool {
		if userID == adminID {
			return sysadminLadderCheckerForTests(rctx, userID, field, action, valueTargetID)
		}
		return defaultLadderCheckerForTests(rctx, userID, field, action, valueTargetID)
	}
	acHook := NewAccessControlHook(th.service, nil, ladder, nil)
	acHook.setPluginCheckerForTests(pluginChecker)
	th.service.AddHook(acHook)
	th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{
		PermissionChecker: func(_ request.CTX, userID string, p *model.Permission) bool {
			return userID == adminID && p.Id == model.PermissionManageSystem.Id
		},
		PluginChecker: pluginChecker,
	}, th.CPAGroupID))
	rctxAdmin := RequestContextWithCallerID(th.Context, adminID)
	rctxSrc := RequestContextWithCallerID(th.Context, "plugin-src")
	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")

	raw := func(t *testing.T, id string) *model.PropertyField {
		f, gErr := th.service.fieldStore.Get(th.Context, th.CPAGroupID, id)
		require.NoError(t, gErr)
		return f
	}
	// System Console save: the GET's attrs object, one key edited, merged onto the row.
	cpaEcho := func(t *testing.T, id string, mutate func(model.StringInterface)) error {
		stored := raw(t, id)
		cpa, cErr := model.NewCPAFieldFromPropertyField(stored)
		require.NoError(t, cErr)
		b, mErr := json.Marshal(cpa)
		require.NoError(t, mErr)
		var wire struct {
			Attrs model.StringInterface `json:"attrs"`
		}
		require.NoError(t, json.Unmarshal(b, &wire))
		mutate(wire.Attrs)
		stored.Patch(&model.PropertyFieldPatch{Attrs: &wire.Attrs}, true)
		_, _, uErr := th.service.UpdatePropertyField(rctxAdmin, th.CPAGroupID, stored)
		return uErr
	}
	// Plugin read-modify-write: the projection, round-tripped through JSON. The RPC
	// boundary uses gob, which gives the same result once the sanitizer has run.
	pluginEcho := func(t *testing.T, rctx request.CTX, id string, mutate func(*model.PropertyField)) error {
		field := raw(t, id)
		var template *model.PropertyField
		if field.LinkSourceID() != "" {
			template = raw(t, field.LinkSourceID())
		}
		b, mErr := json.Marshal(model.ProjectLegacyPermissionsWithTemplate(field, template))
		require.NoError(t, mErr)
		var wire model.PropertyField
		require.NoError(t, json.Unmarshal(b, &wire))
		mutate(&wire)
		_, _, uErr := th.service.UpdatePropertyField(rctx, th.CPAGroupID, &wire)
		return uErr
	}
	reorder := func(attrs model.StringInterface) { attrs[model.PropertyFieldAttrSortOrder] = float64(7) }
	rename := func(f *model.PropertyField) { f.Name += "_renamed" }

	createPlain := func(t *testing.T) *model.PropertyField {
		member := model.PermissionLevelMember
		created, cErr := th.service.CreatePropertyField(rctxAdmin, &model.PropertyField{
			GroupID:          th.CPAGroupID,
			Name:             "plain_" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			ObjectType:       model.PropertyFieldObjectTypeUser,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: &member,
		})
		require.NoError(t, cErr)
		require.Equal(t, model.PermissionLevelMember, created.Permissions.Restrictions.Value.Write)
		return created
	}

	t.Run("unchanged echoes of a plain field keep member value writes and its grants", func(t *testing.T) {
		for name, echo := range map[string]func(t *testing.T, id string) error{
			"system console save": func(t *testing.T, id string) error { return cpaEcho(t, id, reorder) },
			"plugin rename":       func(t *testing.T, id string) error { return pluginEcho(t, rctxSrc, id, rename) },
		} {
			t.Run(name, func(t *testing.T) {
				field := createPlain(t)
				require.NoError(t, echo(t, field.ID))

				stored := raw(t, field.ID)
				assert.Equal(t, model.PermissionLevelMember, stored.Permissions.Restrictions.Value.Write)
				assert.ElementsMatch(t, field.Permissions.Grants, stored.Permissions.Grants)
			})
		}
	})

	t.Run("unchanged echoes of a v3-authored field leave its permissions alone", func(t *testing.T) {
		for name, echo := range map[string]func(t *testing.T, id string) error{
			"system console save": func(t *testing.T, id string) error { return cpaEcho(t, id, reorder) },
			"plugin rename":       func(t *testing.T, id string) error { return pluginEcho(t, rctxOwner, id, rename) },
		} {
			t.Run(name, func(t *testing.T) {
				field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
					GroupID:    th.CPAGroupID,
					Name:       "v3_authored_" + model.NewId(),
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Permissions: &model.Permissions{
						Restrictions: &model.Restrictions{
							Field:  model.WriteOnly{Write: model.PermissionLevelSysadmin},
							Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelMember},
							Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelSysadmin},
						},
						Grants: []model.Grant{{
							Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"},
							Allow: []string{
								model.PropertyActionFieldWrite,
								model.PropertyActionOptionRead,
								model.PropertyActionOptionWrite,
								model.PropertyActionValueRead,
								model.PropertyActionValueWrite,
							},
						}},
					},
				})
				require.NotContains(t, field.Attrs, model.PropertyAttrsOwners)

				require.NoError(t, echo(t, field.ID))
				assert.Equal(t, field.Permissions, raw(t, field.ID).Permissions)
			})
		}
	})

	t.Run("a plugin rename echo of a linked field succeeds and leaves its permissions and attrs alone", func(t *testing.T) {
		sysadmin := model.PermissionLevelSysadmin
		template, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
			GroupID:          th.CPAGroupID,
			Name:             "template_" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			ObjectType:       model.PropertyFieldObjectTypeTemplate,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: &sysadmin,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:  true,
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			},
		})
		require.NoError(t, cErr)
		linked, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "linked_" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, cErr)
		before := raw(t, linked.ID)

		require.NoError(t, pluginEcho(t, rctxSrc, linked.ID, rename))

		stored := raw(t, linked.ID)
		assert.Equal(t, before.Permissions, stored.Permissions)
		assert.Equal(t, true, stored.Attrs[model.PropertyAttrsProtected])
		assert.Equal(t, model.PropertyAccessModeSharedOnly, stored.Attrs[model.PropertyAttrsAccessMode])
	})

	t.Run("a column change echoed from the projection moves value.write to the submitted level", func(t *testing.T) {
		field := createPlain(t)
		require.NoError(t, pluginEcho(t, rctxSrc, field.ID, func(f *model.PropertyField) {
			admin := model.PermissionLevelAdmin
			f.PermissionValues = &admin
		}))
		assert.Equal(t, model.PermissionLevelAdmin, raw(t, field.ID).Permissions.Restrictions.Value.Write)
	})

	t.Run("unchanged echoes of a scoped owner keep its grants", func(t *testing.T) {
		for name, echo := range map[string]func(t *testing.T, id string) error{
			"system console save": func(t *testing.T, id string) error { return cpaEcho(t, id, reorder) },
			"plugin rename":       func(t *testing.T, id string) error { return pluginEcho(t, rctxOwner, id, rename) },
		} {
			t.Run(name, func(t *testing.T) {
				field, cErr := th.service.CreatePropertyField(rctxAdmin, ownerField(th.CPAGroupID, "scoped_"+model.NewId(), "plugin-owner", []string{"entra"}))
				require.NoError(t, cErr)

				require.NoError(t, echo(t, field.ID))
				assert.ElementsMatch(t, field.Permissions.Grants, raw(t, field.ID).Permissions.Grants)
			})
		}
	})

	t.Run("a plugin rename echo of a field linked to a template with a scoped owner leaves its permissions alone", func(t *testing.T) {
		templateField := ownerField(th.CPAGroupID, "scoped_template_"+model.NewId(), "plugin-owner", []string{"entra"})
		templateField.ObjectType = model.PropertyFieldObjectTypeTemplate
		template, cErr := th.service.CreatePropertyField(rctxAdmin, templateField)
		require.NoError(t, cErr)
		linked, cErr := th.service.CreatePropertyField(rctxAdmin, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "scoped_linked_" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, cErr)
		before := raw(t, linked.ID).Permissions

		require.NoError(t, pluginEcho(t, rctxOwner, linked.ID, rename))
		assert.Equal(t, before, raw(t, linked.ID).Permissions)
	})

	t.Run("unchanged echoes of a v3-authored field splitting one identity across two grants leave its permissions alone", func(t *testing.T) {
		for name, echo := range map[string]func(t *testing.T, id string) error{
			"system console save": func(t *testing.T, id string) error { return cpaEcho(t, id, reorder) },
			"plugin rename":       func(t *testing.T, id string) error { return pluginEcho(t, rctxOwner, id, rename) },
		} {
			t.Run(name, func(t *testing.T) {
				owner := model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}
				field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
					GroupID:    th.CPAGroupID,
					Name:       "v3_split_" + model.NewId(),
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Permissions: &model.Permissions{
						Restrictions: &model.Restrictions{
							Field:  model.WriteOnly{Write: model.PermissionLevelSysadmin},
							Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelMember},
							Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelSysadmin},
						},
						Grants: []model.Grant{
							{Identity: owner, Scopes: []string{"entra"}, Allow: []string{model.PropertyActionValueRead, model.PropertyActionValueWrite}},
							{Identity: owner, Allow: []string{model.PropertyActionFieldWrite, model.PropertyActionOptionRead, model.PropertyActionOptionWrite}},
						},
					},
				})
				require.NotContains(t, field.Attrs, model.PropertyAttrsOwners)

				require.NoError(t, echo(t, field.ID))
				assert.Equal(t, field.Permissions, raw(t, field.ID).Permissions)
			})
		}
	})

	t.Run("unchanged echoes of a field with the most owners allowed succeed", func(t *testing.T) {
		for name, echo := range map[string]func(t *testing.T, id string) error{
			"system console save": func(t *testing.T, id string) error { return cpaEcho(t, id, reorder) },
			"plugin rename":       func(t *testing.T, id string) error { return pluginEcho(t, rctxOwner, id, rename) },
		} {
			t.Run(name, func(t *testing.T) {
				owners := []model.PropertyOwner{{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin}}
				for i := 1; i < model.PropertyOwnersMaxPerField; i++ {
					owners = append(owners, model.PropertyOwner{ID: fmt.Sprintf("plugin-owner-%d", i), Type: model.PropertyOwnerTypePlugin})
				}
				field := ownerField(th.CPAGroupID, "max_owners_"+model.NewId(), "plugin-owner", nil)
				field.Attrs[model.PropertyAttrsOwners] = owners
				created, cErr := th.service.CreatePropertyField(rctxAdmin, field)
				require.NoError(t, cErr)
				require.Greater(t, len(model.GetPropertyFieldOwners(model.ProjectLegacyPermissions(created))), model.PropertyOwnersMaxPerField,
					"the projection must report a synthetic owner on top of the real ones")

				require.NoError(t, echo(t, created.ID))
				assert.ElementsMatch(t, created.Permissions.Grants, raw(t, created.ID).Permissions.Grants)
			})
		}
	})

	t.Run("a field a plugin created with the protected attr", func(t *testing.T) {
		createProtected := func(t *testing.T) *model.PropertyField {
			sysadmin := model.PermissionLevelSysadmin
			created, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
				GroupID:          th.CPAGroupID,
				Name:             "protected_" + model.NewId(),
				Type:             model.PropertyFieldTypeText,
				ObjectType:       model.PropertyFieldObjectTypeUser,
				TargetType:       string(model.PropertyFieldTargetLevelSystem),
				PermissionValues: &sysadmin,
				Attrs:            model.StringInterface{model.PropertyAttrsProtected: true},
			})
			require.NoError(t, cErr)
			require.Equal(t, model.PermissionLevelNone, created.Permissions.Restrictions.TierFor(model.PropertyActionFieldWrite))
			return created
		}

		t.Run("an admin cannot delete it", func(t *testing.T) {
			field := createProtected(t)
			require.ErrorIs(t, th.service.DeletePropertyField(rctxAdmin, th.CPAGroupID, field.ID), ErrAccessDenied)
			raw(t, field.ID)
		})

		t.Run("an admin cannot edit it", func(t *testing.T) {
			for name, edit := range map[string]func(t *testing.T, id string) error{
				"system console save": func(t *testing.T, id string) error { return cpaEcho(t, id, reorder) },
				"rename": func(t *testing.T, id string) error {
					return pluginEcho(t, rctxAdmin, id, rename)
				},
			} {
				t.Run(name, func(t *testing.T) {
					field := createProtected(t)
					before := raw(t, field.ID)

					require.ErrorIs(t, edit(t, field.ID), ErrAccessDenied)
					assert.Equal(t, before, raw(t, field.ID))
				})
			}
		})

		t.Run("a plugin rename echo by its source plugin keeps the attr and the permissions", func(t *testing.T) {
			field := createProtected(t)
			require.NoError(t, pluginEcho(t, rctxSrc, field.ID, rename))

			stored := raw(t, field.ID)
			assert.Equal(t, true, stored.Attrs[model.PropertyAttrsProtected])
			assert.Equal(t, field.Permissions, stored.Permissions)
		})

		t.Run("its source plugin can set source_only from the projection without restating protected", func(t *testing.T) {
			field := createProtected(t)
			require.NoError(t, pluginEcho(t, rctxSrc, field.ID, func(f *model.PropertyField) {
				f.Attrs[model.PropertyAttrsAccessMode] = model.PropertyAccessModeSourceOnly
			}))
			assert.Equal(t, model.PermissionLevelNone, raw(t, field.ID).Permissions.Restrictions.TierFor(model.PropertyActionValueRead))
		})

		unprotect := func(f *model.PropertyField) { f.Attrs[model.PropertyAttrsProtected] = false }

		t.Run("its source plugin can unprotect it from the projection", func(t *testing.T) {
			field := createProtected(t)
			require.NoError(t, pluginEcho(t, rctxSrc, field.ID, unprotect))

			stored := raw(t, field.ID)
			assert.Equal(t, model.PermissionLevelSysadmin, stored.Permissions.Restrictions.TierFor(model.PropertyActionFieldWrite))
			assert.False(t, stored.Protected)
			assert.False(t, model.IsPropertyFieldProtected(stored))

			require.NoError(t, pluginEcho(t, rctxSrc, field.ID, func(f *model.PropertyField) {
				f.Attrs[model.PropertyAttrsProtected] = true
			}))
			assert.Equal(t, model.PermissionLevelNone, raw(t, field.ID).Permissions.Restrictions.TierFor(model.PropertyActionFieldWrite))
		})

		t.Run("an admin cannot unprotect it", func(t *testing.T) {
			for name, edit := range map[string]func(t *testing.T, id string) error{
				"system console save": func(t *testing.T, id string) error {
					return cpaEcho(t, id, func(attrs model.StringInterface) { attrs[model.PropertyAttrsProtected] = false })
				},
				"plugin api echo": func(t *testing.T, id string) error { return pluginEcho(t, rctxAdmin, id, unprotect) },
			} {
				t.Run(name, func(t *testing.T) {
					field := createProtected(t)
					before := raw(t, field.ID)

					require.ErrorIs(t, edit(t, field.ID), ErrAccessDenied)
					assert.Equal(t, before, raw(t, field.ID))
				})
			}
		})
	})

	t.Run("a template protected through the attr, with public reads", func(t *testing.T) {
		sysadmin := model.PermissionLevelSysadmin
		template, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
			GroupID:          th.CPAGroupID,
			Name:             "protected_template_" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			ObjectType:       model.PropertyFieldObjectTypeTemplate,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: &sysadmin,
			Attrs:            model.StringInterface{model.PropertyAttrsProtected: true},
		})
		require.NoError(t, cErr)
		require.Equal(t, model.PermissionLevelEveryone, template.Permissions.Restrictions.TierFor(model.PropertyActionValueRead))
		linkTo := func(rctx request.CTX) (*model.PropertyField, error) {
			return th.service.CreatePropertyField(rctx, &model.PropertyField{
				GroupID:       th.CPAGroupID,
				Name:          "protected_linked_" + model.NewId(),
				Type:          model.PropertyFieldTypeText,
				ObjectType:    model.PropertyFieldObjectTypeUser,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID: &template.ID,
			})
		}

		t.Run("refuses a human's link", func(t *testing.T) {
			_, lErr := linkTo(rctxAdmin)
			var appErr *model.AppError
			require.ErrorAs(t, lErr, &appErr)
			assert.Equal(t, "app.property_field.create.linked_source_protected.app_error", appErr.Id)
			assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		})

		t.Run("lets its source plugin link to it and update the linked field", func(t *testing.T) {
			linked, lErr := linkTo(rctxSrc)
			require.NoError(t, lErr)
			assert.Equal(t, model.PermissionLevelNone, linked.Permissions.Restrictions.TierFor(model.PropertyActionFieldWrite))

			require.NoError(t, pluginEcho(t, rctxSrc, linked.ID, rename))
		})
	})

	t.Run("a linked field's echo after its template gains masking leaves its permissions alone", func(t *testing.T) {
		sysadmin := model.PermissionLevelSysadmin
		template, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
			GroupID:          th.CPAGroupID,
			Name:             "unmasked_template_" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			ObjectType:       model.PropertyFieldObjectTypeTemplate,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: &sysadmin,
			Attrs:            model.StringInterface{model.PropertyAttrsProtected: true},
		})
		require.NoError(t, cErr)
		linked, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "stale_linked_" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, cErr)
		require.NoError(t, pluginEcho(t, rctxSrc, template.ID, func(f *model.PropertyField) {
			f.Attrs[model.PropertyAttrsAccessMode] = model.PropertyAccessModeSharedOnly
		}))
		require.NotNil(t, raw(t, template.ID).Permissions.Masking)
		before := raw(t, linked.ID)
		require.NotContains(t, before.Attrs, model.PropertyAttrsAccessMode)

		require.NoError(t, pluginEcho(t, rctxSrc, linked.ID, rename))
		assert.Equal(t, before.Permissions, raw(t, linked.ID).Permissions)
	})

	t.Run("a linked create by the template's source plugin", func(t *testing.T) {
		createTemplate := func(t *testing.T, attrs model.StringInterface) *model.PropertyField {
			sysadmin := model.PermissionLevelSysadmin
			template, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
				GroupID:          th.CPAGroupID,
				Name:             "copy_template_" + model.NewId(),
				Type:             model.PropertyFieldTypeText,
				ObjectType:       model.PropertyFieldObjectTypeTemplate,
				TargetType:       string(model.PropertyFieldTargetLevelSystem),
				PermissionValues: &sysadmin,
				Attrs:            attrs,
			})
			require.NoError(t, cErr)
			return template
		}
		link := func(t *testing.T, template *model.PropertyField, pin *model.PermissionLevel) *model.PropertyField {
			linked, cErr := th.service.CreatePropertyField(rctxSrc, &model.PropertyField{
				GroupID:          th.CPAGroupID,
				Name:             "copy_linked_" + model.NewId(),
				Type:             model.PropertyFieldTypeText,
				ObjectType:       model.PropertyFieldObjectTypeUser,
				TargetType:       string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID:    &template.ID,
				PermissionValues: pin,
			})
			require.NoError(t, cErr)
			return linked
		}

		t.Run("copies protected and access_mode from a protected shared_only template", func(t *testing.T) {
			template := createTemplate(t, model.StringInterface{
				model.PropertyAttrsProtected:  true,
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			})
			stored := raw(t, link(t, template, nil).ID)
			assert.Equal(t, true, stored.Attrs[model.PropertyAttrsProtected])
			assert.Equal(t, model.PropertyAccessModeSharedOnly, stored.Attrs[model.PropertyAttrsAccessMode])
		})

		t.Run("copies only protected from a protected public template", func(t *testing.T) {
			template := createTemplate(t, model.StringInterface{model.PropertyAttrsProtected: true})
			stored := raw(t, link(t, template, nil).ID)
			assert.Equal(t, true, stored.Attrs[model.PropertyAttrsProtected])
			assert.NotContains(t, stored.Attrs, model.PropertyAttrsAccessMode)
		})

		t.Run("copies neither from an unprotected template", func(t *testing.T) {
			template := createTemplate(t, nil)
			stored := raw(t, link(t, template, nil).ID)
			assert.NotContains(t, stored.Attrs, model.PropertyAttrsProtected)
			assert.NotContains(t, stored.Attrs, model.PropertyAttrsAccessMode)
		})

		t.Run("a value pin under a protected template converts to value.write none", func(t *testing.T) {
			template := createTemplate(t, model.StringInterface{model.PropertyAttrsProtected: true})
			member := model.PermissionLevelMember
			linked := link(t, template, &member)
			assert.Equal(t, model.PermissionLevelNone, raw(t, linked.ID).Permissions.Restrictions.TierFor(model.PropertyActionValueWrite))
		})
	})

	t.Run("adding a real owner through a system console save still makes the field owner-managed", func(t *testing.T) {
		field := createPlain(t)
		require.NoError(t, cpaEcho(t, field.ID, func(attrs model.StringInterface) {
			owners, _ := attrs[model.PropertyAttrsOwners].([]any)
			attrs[model.PropertyAttrsOwners] = append(owners, map[string]any{"id": "plugin-owner", "type": model.PropertyOwnerTypePlugin})
		}))

		stored := raw(t, field.ID)
		assert.Equal(t, model.PermissionLevelNone, stored.Permissions.Restrictions.Value.Write)
		owners := model.GetPropertyFieldOwners(stored)
		require.Len(t, owners, 1)
		assert.Equal(t, "plugin-owner", owners[0].ID)
	})
}
