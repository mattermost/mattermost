// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// listingEnv seeds fields into the access_control group under a name prefix
// unique to the test, and searches only for that prefix, so a field some other
// test or a migration left in the group never appears in a result.
type listingEnv struct {
	t       *testing.T
	th      *TestHelper
	groupID string
	token   string
}

type listingFieldOption func(*model.PropertyField)

func newListingEnv(t *testing.T, th *TestHelper) *listingEnv {
	t.Helper()
	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	return &listingEnv{t: t, th: th, groupID: group.ID, token: "ga" + strings.ToLower(model.NewId()[:10])}
}

// name is a field name carrying the env's token, so the env's own search finds it.
func (e *listingEnv) name(suffix string) string {
	return e.token + "_" + suffix
}

func (e *listingEnv) create(objectType, name string, opts ...listingFieldOption) *model.PropertyField {
	e.t.Helper()
	field := &model.PropertyField{
		GroupID:    e.groupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: objectType,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}
	for _, opt := range opts {
		opt(field)
	}
	created, err := e.th.Store.PropertyField().Create(field)
	require.NoError(e.t, err)
	return created
}

func (e *listingEnv) template(name string, opts ...listingFieldOption) *model.PropertyField {
	e.t.Helper()
	return e.create(model.PropertyFieldObjectTypeTemplate, name, opts...)
}

func (e *listingEnv) linked(template *model.PropertyField, objectType, name string, opts ...listingFieldOption) *model.PropertyField {
	e.t.Helper()
	return e.create(objectType, name, append([]listingFieldOption{func(f *model.PropertyField) {
		f.LinkedFieldID = &template.ID
	}}, opts...)...)
}

func (e *listingEnv) remove(field *model.PropertyField) {
	e.t.Helper()
	require.NoError(e.t, e.th.Store.PropertyField().Delete(field.GroupID, field.ID))
}

func withAttrs(attrs model.StringInterface) listingFieldOption {
	return func(f *model.PropertyField) { f.Attrs = attrs }
}

func withOwners(owners ...model.PropertyOwner) listingFieldOption {
	return func(f *model.PropertyField) {
		if f.Attrs == nil {
			f.Attrs = model.StringInterface{}
		}
		f.Attrs[model.PropertyAttrsOwners] = owners
	}
}

func (e *listingEnv) search(mutate ...func(*model.GlobalAttributeListingSearch)) (*model.GlobalAttributeListing, *model.AppError) {
	e.t.Helper()
	search := model.GlobalAttributeListingSearch{Term: e.token}
	for _, m := range mutate {
		m(&search)
	}
	search.SetDefaults()
	return e.th.App.SearchGlobalAttributeListing(e.th.Context, search)
}

func (e *listingEnv) mustSearch(mutate ...func(*model.GlobalAttributeListingSearch)) *model.GlobalAttributeListing {
	e.t.Helper()
	listing, appErr := e.search(mutate...)
	require.Nil(e.t, appErr)
	return listing
}

func listingRowNames(listing *model.GlobalAttributeListing) []string {
	names := make([]string, 0, len(listing.Rows))
	for _, row := range listing.Rows {
		names = append(names, row.Field.Name)
	}
	return names
}

func (e *listingEnv) row(listing *model.GlobalAttributeListing, name string) *model.GlobalAttributeListingRow {
	e.t.Helper()
	for _, row := range listing.Rows {
		if row.Field.Name == name {
			return row
		}
	}
	require.Failf(e.t, "row not found", "no row named %q in %v", name, listingRowNames(listing))
	return nil
}

func (e *listingEnv) rowByID(listing *model.GlobalAttributeListing, id string) *model.GlobalAttributeListingRow {
	e.t.Helper()
	for _, row := range listing.Rows {
		if row.Field.ID == id {
			return row
		}
	}
	require.Failf(e.t, "row not found", "no row with id %q in %v", id, listingRowNames(listing))
	return nil
}

func withSource(source string) func(*model.GlobalAttributeListingSearch) {
	return func(s *model.GlobalAttributeListingSearch) { s.Source = source }
}

func withTerm(term string) func(*model.GlobalAttributeListingSearch) {
	return func(s *model.GlobalAttributeListingSearch) { s.Term = term }
}

func withPaging(page, perPage int) func(*model.GlobalAttributeListingSearch) {
	return func(s *model.GlobalAttributeListingSearch) { s.Page, s.PerPage = page, perPage }
}

func setListingLicense(t *testing.T, th *TestHelper, license *model.License) {
	t.Helper()
	if license == nil {
		_ = th.App.Srv().RemoveLicense()
	} else {
		require.True(t, th.App.Srv().SetLicense(license))
	}
	t.Cleanup(func() { _ = th.App.Srv().RemoveLicense() })
}

// setupListingHelper starts a server with the three feature flags the listing
// reads set as given. Feature flags cannot be changed once the server is running,
// and an MM_FEATUREFLAGS_* variable in the environment would override the config,
// so the caller pins the variables to the same values with t.Setenv, which also
// means it cannot run in parallel.
func setupListingHelper(t *testing.T, channel, post, classification bool) *TestHelper {
	t.Helper()
	t.Setenv("MM_FEATUREFLAGS_CHANNELATTRIBUTES", strconv.FormatBool(channel))
	t.Setenv("MM_FEATUREFLAGS_POSTATTRIBUTES", strconv.FormatBool(post))
	t.Setenv("MM_FEATUREFLAGS_CLASSIFICATIONMARKINGS", strconv.FormatBool(classification))
	return SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = channel
		cfg.FeatureFlags.PostAttributes = post
		cfg.FeatureFlags.ClassificationMarkings = classification
	}).InitBasic(t)
}

// setupListingHelperAllFlags is for the tests that need every resource type
// reachable and run in parallel with the rest of the package.
func setupListingHelperAllFlags(t *testing.T) *TestHelper {
	t.Helper()
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = true
		cfg.FeatureFlags.PostAttributes = true
		cfg.FeatureFlags.ClassificationMarkings = true
	}).InitBasic(t)
	setListingLicense(t, th, model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	return th
}

func TestSearchGlobalAttributeListingGating(t *testing.T) {
	licenses := []struct {
		name     string
		license  *model.License
		advanced bool
	}{
		{"enterprise", model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise), false},
		{"enterprise advanced", model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced), true},
	}

	t.Run("a licence below Enterprise is refused as the generic endpoints refuse it", func(t *testing.T) {
		th := setupListingHelper(t, true, true, true)
		env := newListingEnv(t, th)
		env.template(env.name("any"))

		for name, license := range map[string]*model.License{
			"no licence":   nil,
			"professional": model.NewTestLicenseSKU(model.LicenseShortSkuProfessional),
		} {
			t.Run(name, func(t *testing.T) {
				setListingLicense(t, th, license)
				listing, appErr := env.search()
				require.NotNil(t, appErr)
				assert.Nil(t, listing)
				assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
				assert.Equal(t, "app.property.license_error", appErr.Id)
			})
		}
	})

	for _, channelFlag := range []bool{false, true} {
		for _, postFlag := range []bool{false, true} {
			for _, classificationFlag := range []bool{false, true} {
				name := "channel=" + boolName(channelFlag) + "/post=" + boolName(postFlag) + "/classification=" + boolName(classificationFlag)
				t.Run(name, func(t *testing.T) {
					th := setupListingHelper(t, channelFlag, postFlag, classificationFlag)
					env := newListingEnv(t, th)

					userField := env.create(model.PropertyFieldObjectTypeUser, env.name("user"))
					channelField := env.create(model.PropertyFieldObjectTypeChannel, env.name("channel"))
					postField := env.create(model.PropertyFieldObjectTypePost, env.name("post"))

					template := env.template(env.name("all"))
					env.linked(template, model.PropertyFieldObjectTypeUser, env.name("all_u"))
					env.linked(template, model.PropertyFieldObjectTypeChannel, env.name("all_c"))
					env.linked(template, model.PropertyFieldObjectTypePost, env.name("all_p"))

					classification := env.create(model.PropertyFieldObjectTypeTemplate, "classification", func(f *model.PropertyField) {
						f.Type = model.PropertyFieldTypeRank
						f.Attrs = model.StringInterface{"display_name": env.name("classification display")}
					})

					for _, l := range licenses {
						t.Run(l.name, func(t *testing.T) {
							setListingLicense(t, th, l.license)

							channelAllowed := channelFlag && l.advanced
							postAllowed := postFlag
							classificationReachable := classificationFlag && l.advanced

							listing := env.mustSearch()

							expected := []string{userField.Name, template.Name}
							expectedAppliesTo := []string{model.PropertyFieldObjectTypeUser}
							if channelAllowed {
								expected = append(expected, channelField.Name)
								expectedAppliesTo = append(expectedAppliesTo, model.PropertyFieldObjectTypeChannel)
							}
							if postAllowed {
								expected = append(expected, postField.Name)
								expectedAppliesTo = append(expectedAppliesTo, model.PropertyFieldObjectTypePost)
							}
							if classificationReachable {
								expected = append(expected, classification.Name)
							}
							assert.ElementsMatch(t, expected, listingRowNames(listing))
							assert.EqualValues(t, len(expected), listing.TotalCount)

							assert.Equal(t, expectedAppliesTo, env.row(listing, template.Name).AppliesTo)

							for _, row := range listing.Rows {
								assert.Equal(t, row.Field.ID == classification.ID, row.IsClassification, row.Field.Name)
							}

							// A resource type that is not allowed lists nothing, though a field of it exists.
							for resourceType, allowed := range map[string]bool{
								model.PropertyFieldObjectTypeChannel: channelAllowed,
								model.PropertyFieldObjectTypePost:    postAllowed,
							} {
								filtered := env.mustSearch(func(s *model.GlobalAttributeListingSearch) { s.ResourceType = resourceType })
								assert.Equal(t, allowed, len(filtered.Rows) > 0, "resource type %s", resourceType)
							}
						})
					}
				})
			}
		}
	}

	t.Run("a non-rank template named classification is an ordinary row", func(t *testing.T) {
		th := setupListingHelper(t, false, false, false)
		setListingLicense(t, th, licenses[0].license)
		env := newListingEnv(t, th)

		ordinary := env.create(model.PropertyFieldObjectTypeTemplate, "classification")

		row := env.row(env.mustSearch(withTerm("classification")), ordinary.Name)
		assert.False(t, row.IsClassification)
	})
}

func boolName(b bool) string {
	if b {
		return "on"
	}
	return "off"
}

func TestSearchGlobalAttributeListingAppliesTo(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupListingHelperAllFlags(t)
	env := newListingEnv(t, th)

	t.Run("a template lists its linked resource types in the order user, channel, post", func(t *testing.T) {
		template := env.template(env.name("ordered"))
		// Created in the reverse of the display order.
		env.linked(template, model.PropertyFieldObjectTypePost, env.name("ordered_p"))
		env.linked(template, model.PropertyFieldObjectTypeChannel, env.name("ordered_c"))
		env.linked(template, model.PropertyFieldObjectTypeUser, env.name("ordered_u"))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Equal(t, []string{"user", "channel", "post"}, row.AppliesTo)
	})

	t.Run("a template with a subset lists only that subset", func(t *testing.T) {
		template := env.template(env.name("subset"))
		env.linked(template, model.PropertyFieldObjectTypePost, env.name("subset_p"))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Equal(t, []string{"post"}, row.AppliesTo)
	})

	t.Run("a deleted linked field no longer counts", func(t *testing.T) {
		template := env.template(env.name("shrunk"))
		env.linked(template, model.PropertyFieldObjectTypeUser, env.name("shrunk_u"))
		channelChild := env.linked(template, model.PropertyFieldObjectTypeChannel, env.name("shrunk_c"))
		env.remove(channelChild)

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Equal(t, []string{"user"}, row.AppliesTo)
	})

	t.Run("a template with no linked fields applies to nothing, as an empty list", func(t *testing.T) {
		template := env.template(env.name("bare"))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.NotNil(t, row.AppliesTo)
		assert.Empty(t, row.AppliesTo)
	})

	t.Run("an unlinked resource field applies to its own type", func(t *testing.T) {
		for _, objectType := range []string{"user", "channel", "post"} {
			field := env.create(objectType, env.name("own_"+objectType))
			row := env.row(env.mustSearch(withTerm(field.Name)), field.Name)
			assert.Equal(t, []string{objectType}, row.AppliesTo)
		}
	})

	t.Run("a resource field linked to a template is not a row of its own", func(t *testing.T) {
		template := env.template(env.name("parent"))
		child := env.linked(template, model.PropertyFieldObjectTypeUser, env.name("parent_child"))

		assert.NotContains(t, listingRowNames(env.mustSearch(withTerm(child.Name))), child.Name)
	})
}

func TestSearchGlobalAttributeListingOwners(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupListingHelperAllFlags(t)
	env := newListingEnv(t, th)

	scim := model.PropertyOwner{ID: "scim", Type: model.PropertyOwnerTypeService, Scopes: []string{"local"}}
	plugin := model.PropertyOwner{ID: "com.example.plugin", Type: model.PropertyOwnerTypePlugin, Scopes: []string{}}

	t.Run("a template takes its owners from its linked user field", func(t *testing.T) {
		template := env.template(env.name("owned"))
		env.linked(template, model.PropertyFieldObjectTypeUser, env.name("owned_u"), withOwners(scim, plugin))
		env.linked(template, model.PropertyFieldObjectTypeChannel, env.name("owned_c"), withOwners(model.PropertyOwner{ID: "ignored", Type: model.PropertyOwnerTypeService}))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Equal(t, []model.PropertyOwner{scim, plugin}, row.Owners)
	})

	t.Run("a template with no owned user field has an empty list, not null", func(t *testing.T) {
		template := env.template(env.name("unowned"))
		env.linked(template, model.PropertyFieldObjectTypeUser, env.name("unowned_u"))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.NotNil(t, row.Owners)
		assert.Empty(t, row.Owners)
	})

	t.Run("a template whose owned user field was deleted has no owners", func(t *testing.T) {
		template := env.template(env.name("orphan"))
		child := env.linked(template, model.PropertyFieldObjectTypeUser, env.name("orphan_u"), withOwners(scim))
		env.remove(child)

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Empty(t, row.Owners)
	})

	t.Run("a user row reads its own owners", func(t *testing.T) {
		field := env.create(model.PropertyFieldObjectTypeUser, env.name("own_user"), withOwners(scim))

		row := env.row(env.mustSearch(withTerm(field.Name)), field.Name)
		assert.Equal(t, []model.PropertyOwner{scim}, row.Owners)
	})

	t.Run("channel and post rows have no owners", func(t *testing.T) {
		for _, objectType := range []string{"channel", "post"} {
			field := env.create(objectType, env.name("noowner_"+objectType), withOwners(scim))
			row := env.row(env.mustSearch(withTerm(field.Name)), field.Name)
			assert.NotNil(t, row.Owners)
			assert.Empty(t, row.Owners)
		}
	})

	t.Run("owners do not change the source kind", func(t *testing.T) {
		template := env.template(env.name("owned_kind"))
		env.linked(template, model.PropertyFieldObjectTypeUser, env.name("owned_kind_u"), withOwners(plugin))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Equal(t, model.GlobalAttributeSourceKindManaged, row.SourceKind)
	})

	t.Run("the source filter sees a plugin owner on the linked user field", func(t *testing.T) {
		template := env.template(env.name("plugin_owned"))
		env.linked(template, model.PropertyFieldObjectTypeUser, env.name("plugin_owned_u"), withOwners(plugin))
		serviceOwned := env.template(env.name("service_owned"))
		env.linked(serviceOwned, model.PropertyFieldObjectTypeUser, env.name("service_owned_u"), withOwners(scim))

		pluginRows := listingRowNames(env.mustSearch(withSource(model.GlobalAttributeSourcePlugin)))
		assert.Contains(t, pluginRows, template.Name)
		assert.NotContains(t, pluginRows, serviceOwned.Name)

		// An owned attribute is not "managed here", whoever owns it.
		managedRows := listingRowNames(env.mustSearch(withSource(model.GlobalAttributeSourceManaged)))
		assert.NotContains(t, managedRows, template.Name)
		assert.NotContains(t, managedRows, serviceOwned.Name)
	})
}

func TestSearchGlobalAttributeListingReadParity(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupListingHelperAllFlags(t)
	env := newListingEnv(t, th)

	t.Run("a field with a permissions object is returned, and its owners read, as the GET endpoints return it", func(t *testing.T) {
		created, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    env.groupID,
			Name:       env.name("permissioned"),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelAdmin},
				},
			},
		}, true, "")
		require.Nil(t, appErr)
		require.NotNil(t, created.Permissions)

		row := env.row(env.mustSearch(withTerm(created.Name)), created.Name)
		got, appErr := th.App.GetPropertyField(th.Context, env.groupID, created.ID)
		require.Nil(t, appErr)

		assert.Equal(t, got, row.Field)
		assert.NotNil(t, row.Field.Permissions)
		assert.Equal(t, model.GetPropertyFieldOwners(got), orNilOwners(row.Owners))
		assert.Equal(t, model.GetPropertyFieldSyncSources(got), orNilStrings(row.SyncSources))
	})

	t.Run("the row fields are the same ones a search of the generic endpoint returns", func(t *testing.T) {
		template := env.template(env.name("searched"), withAttrs(model.StringInterface{"display_name": "Searched"}))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		fields, appErr := th.App.SearchPropertyFields(th.Context, env.groupID, model.PropertyFieldSearchOpts{
			ObjectTypes: []string{model.PropertyFieldObjectTypeTemplate},
			PerPage:     200,
		})
		require.Nil(t, appErr)

		var generic *model.PropertyField
		for _, field := range fields {
			if field.ID == template.ID {
				generic = field
			}
		}
		require.NotNil(t, generic)
		assert.Equal(t, generic, row.Field)
	})
}

func orNilOwners(owners []model.PropertyOwner) []model.PropertyOwner {
	if len(owners) == 0 {
		return nil
	}
	return owners
}

func orNilStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	return values
}

func TestSearchGlobalAttributeListingSourceParity(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupListingHelperAllFlags(t)
	env := newListingEnv(t, th)

	// Mirrors getSourceKind and getPropertyFieldSyncSources in the webapp.
	tests := []struct {
		name        string
		attrs       model.StringInterface
		kind        string
		syncSources []string
	}{
		{"nothing set", nil, "managed", []string{}},
		{"empty attrs", model.StringInterface{}, "managed", []string{}},
		{"empty ldap mapping", model.StringInterface{"ldap": ""}, "managed", []string{}},
		{"non-string ldap mapping", model.StringInterface{"ldap": true}, "managed", []string{}},
		{"ldap", model.StringInterface{"ldap": "x"}, "external", []string{"ldap"}},
		{"saml", model.StringInterface{"saml": "y"}, "external", []string{"saml"}},
		{"openid", model.StringInterface{"openid": "z"}, "external", []string{"openid"}},
		{"ldap and saml keep the ldap, saml, openid order", model.StringInterface{"saml": "y", "ldap": "x"}, "external", []string{"ldap", "saml"}},
		{"plugin id without protected is not a plugin", model.StringInterface{"source_plugin_id": "p"}, "managed", []string{}},
		{"plugin id with protected false is not a plugin", model.StringInterface{"source_plugin_id": "p", "protected": false}, "managed", []string{}},
		{"protected without a plugin id is not a plugin", model.StringInterface{"protected": true}, "managed", []string{}},
		{"plugin id and protected", model.StringInterface{"source_plugin_id": "p", "protected": true}, "plugin", []string{}},
		{"plugin wins over a sync mapping and still reports it", model.StringInterface{"source_plugin_id": "p", "protected": true, "ldap": "x", "saml": "y"}, "plugin", []string{"ldap", "saml"}},
	}

	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := env.create(model.PropertyFieldObjectTypeUser, env.name("src_"+string(rune('a'+i))), withAttrs(tt.attrs))

			row := env.row(env.mustSearch(withTerm(field.Name)), field.Name)
			assert.Equal(t, tt.kind, row.SourceKind)
			assert.Equal(t, tt.syncSources, row.SyncSources)
		})
	}

	t.Run("the source filter agrees with the reported source kind and sync sources", func(t *testing.T) {
		listing := env.mustSearch(withSource(model.GlobalAttributeSourcePlugin))
		for _, row := range listing.Rows {
			assert.Equal(t, model.GlobalAttributeSourceKindPlugin, row.SourceKind, row.Field.Name)
		}
		assert.NotEmpty(t, listing.Rows)

		for _, source := range model.PropertySyncSources() {
			listing := env.mustSearch(withSource(source))
			assert.NotEmpty(t, listing.Rows, source)
			for _, row := range listing.Rows {
				assert.Contains(t, row.SyncSources, source, row.Field.Name)
			}
		}

		for _, row := range env.mustSearch(withSource(model.GlobalAttributeSourceManaged)).Rows {
			assert.Equal(t, model.GlobalAttributeSourceKindManaged, row.SourceKind, row.Field.Name)
			assert.Empty(t, row.SyncSources, row.Field.Name)
		}
	})

	t.Run("a field synced from several sources matches each", func(t *testing.T) {
		field := env.create(model.PropertyFieldObjectTypeUser, env.name("multi"), withAttrs(model.StringInterface{"ldap": "a", "saml": "b"}))

		assert.Contains(t, listingRowNames(env.mustSearch(withSource(model.GlobalAttributeSourceLDAP))), field.Name)
		assert.Contains(t, listingRowNames(env.mustSearch(withSource(model.GlobalAttributeSourceSAML))), field.Name)
		assert.NotContains(t, listingRowNames(env.mustSearch(withSource(model.GlobalAttributeSourceOpenID))), field.Name)
	})
}

func TestSearchGlobalAttributeListingPluginCreatedField(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = false
		cfg.FeatureFlags.PostAttributes = false
	}).InitBasic(t)
	setListingLicense(t, th, model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	env := newListingEnv(t, th)

	pluginFieldName := env.name("from_plugin")
	tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
		package main

		import (
			"fmt"
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnActivate() error {
			_, err := p.API.CreatePropertyField(&model.PropertyField{
				GroupID:    "` + env.groupID + `",
				Name:       "` + pluginFieldName + `",
				Type:       model.PropertyFieldTypeText,
				ObjectType: model.PropertyFieldObjectTypeUser,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Attrs: map[string]any{
					"protected": true,
				},
			})
			if err != nil {
				return fmt.Errorf("failed to create the protected field: %w", err)
			}
			return nil
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.Len(t, activationErrors, 1)
	require.NoError(t, activationErrors[0])

	ordinary := env.create(model.PropertyFieldObjectTypeUser, env.name("ordinary"))

	t.Run("it is reported as plugin-sourced and listed under the plugin filter only", func(t *testing.T) {
		listing := env.mustSearch()
		row := env.row(listing, pluginFieldName)
		assert.Equal(t, model.GlobalAttributeSourceKindPlugin, row.SourceKind)
		assert.Equal(t, pluginIDs[0], row.Field.Attrs[model.PropertyAttrsSourcePluginID])
		assert.Equal(t, model.GlobalAttributeSourceKindManaged, env.row(listing, ordinary.Name).SourceKind)

		pluginRows := listingRowNames(env.mustSearch(withSource(model.GlobalAttributeSourcePlugin)))
		assert.Equal(t, []string{pluginFieldName}, pluginRows)

		managedRows := listingRowNames(env.mustSearch(withSource(model.GlobalAttributeSourceManaged)))
		assert.Equal(t, []string{ordinary.Name}, managedRows)
	})

	require.Nil(t, th.App.DisablePlugin(pluginIDs[0]))
	require.Nil(t, th.App.ch.RemovePlugin(pluginIDs[0]))
}

func TestSearchGlobalAttributeListingNameConflicts(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupListingHelperAllFlags(t)
	env := newListingEnv(t, th)

	t.Run("a template and a standalone user field sharing a name ignoring case conflict, as a case-only match", func(t *testing.T) {
		standalone := env.create(model.PropertyFieldObjectTypeUser, env.name("Clearance"))
		template := env.template(env.name("clearance"))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		require.NotNil(t, row.NameConflict)
		assert.Equal(t, standalone.ID, row.NameConflict.Field.ID)
		assert.Nil(t, row.NameConflict.OwnerTemplate)
		assert.False(t, row.NameConflict.Exact)

		// The user field conflicts back with the template, which is not a user field.
		userRow := env.row(env.mustSearch(withTerm(standalone.Name)), standalone.Name)
		assert.Nil(t, userRow.NameConflict)
	})

	t.Run("two user fields whose names differ only in case conflict with each other", func(t *testing.T) {
		upper := env.create(model.PropertyFieldObjectTypeUser, env.name("Tier"))
		lower := env.create(model.PropertyFieldObjectTypeUser, env.name("tier"))

		listing := env.mustSearch(withTerm(env.name("tier")))
		upperRow, lowerRow := env.row(listing, upper.Name), env.row(listing, lower.Name)
		require.NotNil(t, upperRow.NameConflict)
		require.NotNil(t, lowerRow.NameConflict)
		assert.Equal(t, lower.ID, upperRow.NameConflict.Field.ID)
		assert.Equal(t, upper.ID, lowerRow.NameConflict.Field.ID)
		assert.False(t, upperRow.NameConflict.Exact)
		assert.False(t, lowerRow.NameConflict.Exact)
	})

	t.Run("a user field linked to another template reports that template as its owner", func(t *testing.T) {
		owner := env.template(env.name("owner_tpl"), withAttrs(model.StringInterface{"display_name": "Owner"}))
		child := env.linked(owner, model.PropertyFieldObjectTypeUser, env.name("Level"))
		other := env.template(env.name("level"))

		row := env.row(env.mustSearch(withTerm(other.Name)), other.Name)
		require.NotNil(t, row.NameConflict)
		assert.Equal(t, child.ID, row.NameConflict.Field.ID)
		require.NotNil(t, row.NameConflict.OwnerTemplate)
		assert.Equal(t, owner.ID, row.NameConflict.OwnerTemplate.ID)
		assert.False(t, row.NameConflict.Exact)
	})

	t.Run("a template does not conflict with its own linked user field or with itself", func(t *testing.T) {
		template := env.template(env.name("own_child"))
		env.linked(template, model.PropertyFieldObjectTypeUser, template.Name)

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Nil(t, row.NameConflict)
	})

	t.Run("a template does not conflict with its own linked child when the child differs only in case", func(t *testing.T) {
		template := env.template(env.name("self"))
		env.linked(template, model.PropertyFieldObjectTypeUser, env.name("Self"))

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Nil(t, row.NameConflict)
	})

	t.Run("an exact match wins over a case-only match whichever was created first", func(t *testing.T) {
		for name, order := range map[string][]string{
			"exact first":     {"exact", "EXACT"},
			"case-only first": {"EXACT", "exact"},
		} {
			t.Run(name, func(t *testing.T) {
				env := newListingEnv(t, th)
				var ids = map[string]string{}
				for _, suffix := range order {
					ids[suffix] = env.create(model.PropertyFieldObjectTypeUser, env.name(suffix)).ID
				}
				template := env.template(env.name("exact"))

				// The user field named exactly like the template is a row too, so pick by ID.
				row := env.rowByID(env.mustSearch(withTerm(template.Name)), template.ID)
				require.NotNil(t, row.NameConflict)
				assert.Equal(t, ids["exact"], row.NameConflict.Field.ID)
				assert.True(t, row.NameConflict.Exact)
			})
		}
	})

	t.Run("a deleted user field is not a conflict", func(t *testing.T) {
		gone := env.create(model.PropertyFieldObjectTypeUser, env.name("Gone"))
		template := env.template(env.name("gone"))
		env.remove(gone)

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		assert.Nil(t, row.NameConflict)
	})

	t.Run("channel and post rows never conflict", func(t *testing.T) {
		env.create(model.PropertyFieldObjectTypeUser, env.name("Shared"))
		channel := env.create(model.PropertyFieldObjectTypeChannel, env.name("shared"))
		post := env.create(model.PropertyFieldObjectTypePost, env.name("SHARED"))

		listing := env.mustSearch(withTerm(env.name("shared")))
		assert.Nil(t, env.row(listing, channel.Name).NameConflict)
		assert.Nil(t, env.row(listing, post.Name).NameConflict)
	})

	t.Run("a conflict whose owning template is gone is reported without the owner", func(t *testing.T) {
		owner := env.template(env.name("vanished_tpl"))
		env.linked(owner, model.PropertyFieldObjectTypeUser, env.name("Orphaned"))
		template := env.template(env.name("orphaned"))
		env.remove(owner)

		row := env.row(env.mustSearch(withTerm(template.Name)), template.Name)
		require.NotNil(t, row.NameConflict)
		assert.Nil(t, row.NameConflict.OwnerTemplate)
		assert.Equal(t, env.name("Orphaned"), row.NameConflict.Field.Name)
	})

	t.Run("a conflict whose owning template was removed outright is reported without the owner", func(t *testing.T) {
		owner := env.template(env.name("purged_tpl"))
		env.linked(owner, model.PropertyFieldObjectTypeUser, env.name("Purged"))
		kept := env.template(env.name("kept_tpl"))
		env.linked(kept, model.PropertyFieldObjectTypeUser, env.name("Kept"))
		purged := env.template(env.name("purged"))
		keptRow := env.template(env.name("kept"))
		_, err := th.SQLStore.GetMaster().Exec("DELETE FROM PropertyFields WHERE Id = $1", owner.ID)
		require.NoError(t, err)

		listing := env.mustSearch(withTerm(env.name("purged")))
		row := env.row(listing, purged.Name)
		require.NotNil(t, row.NameConflict)
		assert.Nil(t, row.NameConflict.OwnerTemplate)

		// The one that is still there is not lost to the one that is not.
		listing = env.mustSearch(withTerm(env.name("kept")))
		row = env.row(listing, keptRow.Name)
		require.NotNil(t, row.NameConflict)
		require.NotNil(t, row.NameConflict.OwnerTemplate)
		assert.Equal(t, kept.ID, row.NameConflict.OwnerTemplate.ID)
	})

	t.Run("only the page's rows are looked up, and each gets its own conflict", func(t *testing.T) {
		env := newListingEnv(t, th)
		a := env.create(model.PropertyFieldObjectTypeUser, env.name("A"))
		b := env.create(model.PropertyFieldObjectTypeUser, env.name("B"))
		ta, tb := env.template(env.name("a")), env.template(env.name("b"))

		listing := env.mustSearch(withPaging(0, 10), withTerm(env.token))
		assert.Equal(t, a.ID, env.row(listing, ta.Name).NameConflict.Field.ID)
		assert.Equal(t, b.ID, env.row(listing, tb.Name).NameConflict.Field.ID)
	})
}

func TestSearchGlobalAttributeListingPaging(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = false
		cfg.FeatureFlags.PostAttributes = false
	}).InitBasic(t)
	setListingLicense(t, th, model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	env := newListingEnv(t, th)

	for _, suffix := range []string{"e", "b", "a", "d", "c"} {
		env.template(env.name(suffix))
	}

	t.Run("pages are consecutive slices of one ordering, and the total is the same on each", func(t *testing.T) {
		var all []string
		for page, expectedLen := range []int{2, 2, 1, 0} {
			listing := env.mustSearch(withPaging(page, 2))
			assert.Len(t, listing.Rows, expectedLen, "page %d", page)
			assert.EqualValues(t, 5, listing.TotalCount, "page %d", page)
			all = append(all, listingRowNames(listing)...)
		}
		assert.Equal(t, []string{env.name("a"), env.name("b"), env.name("c"), env.name("d"), env.name("e")}, all)
	})

	t.Run("a page past the end is empty with the total intact, and rows is an empty list", func(t *testing.T) {
		listing := env.mustSearch(withPaging(9, 2))
		assert.NotNil(t, listing.Rows)
		assert.Empty(t, listing.Rows)
		assert.EqualValues(t, 5, listing.TotalCount)
	})

	t.Run("a page number too large to multiply is an empty page, not a wrapped offset", func(t *testing.T) {
		listing := env.mustSearch(withPaging(int(^uint(0)>>1), 200))
		assert.Empty(t, listing.Rows)
		assert.EqualValues(t, 5, listing.TotalCount)
	})

	t.Run("no match is an empty list and a zero total", func(t *testing.T) {
		listing := env.mustSearch(withTerm(env.token + "_nothing_like_this"))
		assert.NotNil(t, listing.Rows)
		assert.Empty(t, listing.Rows)
		assert.EqualValues(t, 0, listing.TotalCount)
	})

	t.Run("empty lists are encoded as arrays, never null", func(t *testing.T) {
		listing := env.mustSearch(withTerm(env.name("a")))
		data, err := json.Marshal(listing)
		require.NoError(t, err)

		var decoded struct {
			Rows []map[string]json.RawMessage `json:"rows"`
		}
		require.NoError(t, json.Unmarshal(data, &decoded))
		require.Len(t, decoded.Rows, 1)
		assert.JSONEq(t, "[]", string(decoded.Rows[0]["applies_to"]))
		assert.JSONEq(t, "[]", string(decoded.Rows[0]["owners"]))
		assert.JSONEq(t, "[]", string(decoded.Rows[0]["sync_sources"]))
	})

	t.Run("an invalid search is refused by the service", func(t *testing.T) {
		_, appErr := th.App.SearchGlobalAttributeListing(th.Context, model.GlobalAttributeListingSearch{Source: "nope", PerPage: 10})
		require.NotNil(t, appErr)
	})
}

func TestSearchGlobalAttributeListingRowSetAndOrder(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupListingHelperAllFlags(t)
	env := newListingEnv(t, th)

	display := func(name string) listingFieldOption {
		return withAttrs(model.StringInterface{"display_name": name})
	}

	t.Run("a linked field of any resource type is not a row", func(t *testing.T) {
		template := env.template(env.name("parent_any"))
		var children []string
		for _, objectType := range []string{"user", "channel", "post"} {
			children = append(children, env.linked(template, objectType, env.name("child_"+objectType)).Name)
		}

		names := listingRowNames(env.mustSearch(withTerm(env.name("child_"))))
		for _, child := range children {
			assert.NotContains(t, names, child)
		}
		assert.Contains(t, listingRowNames(env.mustSearch(withTerm(template.Name))), template.Name)
	})

	t.Run("templates and unlinked fields sort together by display name, falling back to the name", func(t *testing.T) {
		env := newListingEnv(t, th)
		// Fallback names start with the token, which sorts between "aaa" and "zzz".
		cherry := env.template(env.name("a_name"), display("zzz cherry"))
		apple := env.create(model.PropertyFieldObjectTypeChannel, env.name("zzz"), display("aaa apple"))
		date := env.create(model.PropertyFieldObjectTypePost, env.name("DATE"))
		banana := env.create(model.PropertyFieldObjectTypeUser, env.name("banana"))

		listing := env.mustSearch()
		ids := make([]string, 0, len(listing.Rows))
		for _, row := range listing.Rows {
			ids = append(ids, row.Field.ID)
		}
		assert.Equal(t, []string{apple.ID, banana.ID, date.ID, cherry.ID}, ids)
	})

	t.Run("a conflict is decided by the internal name, not the display label", func(t *testing.T) {
		env := newListingEnv(t, th)
		sameLabelOtherName := env.create(model.PropertyFieldObjectTypeUser, env.name("other"), display("Shared Label"))
		tplDifferentName := env.template(env.name("mine"), display("Shared Label"))
		sameNameOtherLabel := env.create(model.PropertyFieldObjectTypeUser, env.name("same"), display("Label A"))
		tplSameName := env.template(env.name("same"), display("Label B"))

		listing := env.mustSearch()
		assert.Nil(t, env.rowByID(listing, tplDifferentName.ID).NameConflict)
		assert.Nil(t, env.rowByID(listing, sameLabelOtherName.ID).NameConflict)

		row := env.rowByID(listing, tplSameName.ID)
		require.NotNil(t, row.NameConflict)
		assert.Equal(t, sameNameOtherLabel.ID, row.NameConflict.Field.ID)
		assert.True(t, row.NameConflict.Exact)
	})

	t.Run("no collision omits name_conflict", func(t *testing.T) {
		env := newListingEnv(t, th)
		template := env.template(env.name("unique"))
		data, err := json.Marshal(env.row(env.mustSearch(withTerm(template.Name)), template.Name))
		require.NoError(t, err)
		assert.NotContains(t, string(data), "name_conflict")
	})
}
