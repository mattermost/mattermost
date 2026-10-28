// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

const globalAttributesSearchRoute = "/properties/groups/access_control/attributes/search"

func searchGlobalAttributes(tb testing.TB, client *model.Client4, body string) (*model.GlobalAttributeListing, *model.Response, error) {
	tb.Helper()
	r, err := client.DoAPIPost(context.Background(), globalAttributesSearchRoute, body)
	if err != nil {
		return nil, model.BuildResponse(r), err
	}
	defer r.Body.Close()
	return model.DecodeJSONFromResponse[*model.GlobalAttributeListing](r)
}

func searchGlobalAttributesBody(tb testing.TB, search model.GlobalAttributeListingSearch) string {
	tb.Helper()
	data, err := json.Marshal(search)
	require.NoError(tb, err)
	return string(data)
}

func seedListingTemplates(tb testing.TB, th *TestHelper, token string, names ...string) []*model.PropertyField {
	tb.Helper()
	group, err := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(tb, err)

	fields := make([]*model.PropertyField, 0, len(names))
	for _, name := range names {
		field, storeErr := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
			GroupID:    group.ID,
			Name:       token + "_" + name,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(tb, storeErr)
		fields = append(fields, field)
	}
	return fields
}

func TestSearchGlobalAttributeListing(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	t.Cleanup(func() { _ = th.App.Srv().RemoveLicense() })

	token := "ga" + strings.ToLower(model.NewId()[:10])
	seedListingTemplates(t, th, token, "alpha", "bravo", "charlie")
	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	_, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
		GroupID:    group.ID,
		Name:       token + "_ldap_user",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{"ldap": "mail"},
	})
	require.NoError(t, err)

	byToken := func(search model.GlobalAttributeListingSearch) string {
		search.Term = token
		return searchGlobalAttributesBody(t, search)
	}

	t.Run("a system admin gets every matching row in order", func(t *testing.T) {
		listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, byToken(model.GlobalAttributeListingSearch{}))
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		names := make([]string, 0, len(listing.Rows))
		for _, row := range listing.Rows {
			names = append(names, row.Field.Name)
		}
		assert.Equal(t, []string{token + "_alpha", token + "_bravo", token + "_charlie", token + "_ldap_user"}, names)
	})

	t.Run("the response carries every row key, with lists as arrays", func(t *testing.T) {
		r, err := th.SystemAdminClient.DoAPIPost(context.Background(), globalAttributesSearchRoute, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: token + "_ldap"}))
		require.NoError(t, err)
		defer r.Body.Close()

		var raw map[string]json.RawMessage
		require.NoError(t, json.NewDecoder(r.Body).Decode(&raw))
		assert.Equal(t, []string{"rows"}, slices.Collect(maps.Keys(raw)))

		var rows []map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(raw["rows"], &rows))
		require.Len(t, rows, 1)

		row := rows[0]
		for _, key := range []string{"field", "applies_to", "owners", "source_kind", "sync_sources", "is_classification"} {
			assert.Contains(t, row, key)
		}
		assert.JSONEq(t, `["user"]`, string(row["applies_to"]))
		assert.JSONEq(t, `[]`, string(row["owners"]))
		assert.JSONEq(t, `["ldap"]`, string(row["sync_sources"]))
		assert.JSONEq(t, `"external"`, string(row["source_kind"]))
		assert.JSONEq(t, `false`, string(row["is_classification"]))
		assert.NotContains(t, row, "name_conflict")
	})

	t.Run("a system manager can read it, being read-only on User Management", func(t *testing.T) {
		th.LoginSystemManager(t)
		listing, resp, err := searchGlobalAttributes(t, th.SystemManagerClient, byToken(model.GlobalAttributeListingSearch{}))
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Len(t, listing.Rows, 4)
	})

	t.Run("a regular user is refused", func(t *testing.T) {
		_, resp, err := searchGlobalAttributes(t, th.Client, byToken(model.GlobalAttributeListingSearch{}))
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("a request without a session is refused", func(t *testing.T) {
		_, resp, err := searchGlobalAttributes(t, th.CreateClient(), byToken(model.GlobalAttributeListingSearch{}))
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("a role holding only one User Management read permission can read it", func(t *testing.T) {
		role, appErr := th.App.CreateRole(&model.Role{
			Name:        "ga_listing_" + strings.ToLower(model.NewId()[:8]),
			DisplayName: "ga listing reader",
			Permissions: []string{model.PermissionSysconsoleReadUserManagementUsers.Id},
		})
		require.Nil(t, appErr)
		_, appErr = th.App.UpdateUserRoles(th.Context, th.BasicUser2.Id, model.SystemUserRoleId+" "+role.Name, false)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			_, _ = th.App.UpdateUserRoles(th.Context, th.BasicUser2.Id, model.SystemUserRoleId, false)
		})

		th.LoginBasic2(t)
		_, resp, err := searchGlobalAttributes(t, th.Client, byToken(model.GlobalAttributeListingSearch{}))
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		th.LoginBasic(t)
	})

	t.Run("an unrelated sysconsole read permission is not enough", func(t *testing.T) {
		role, appErr := th.App.CreateRole(&model.Role{
			Name:        "ga_listing_" + strings.ToLower(model.NewId()[:8]),
			DisplayName: "ga unrelated reader",
			Permissions: []string{model.PermissionSysconsoleReadReportingSiteStatistics.Id},
		})
		require.Nil(t, appErr)
		_, appErr = th.App.UpdateUserRoles(th.Context, th.BasicUser2.Id, model.SystemUserRoleId+" "+role.Name, false)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			_, _ = th.App.UpdateUserRoles(th.Context, th.BasicUser2.Id, model.SystemUserRoleId, false)
		})

		th.LoginBasic2(t)
		_, resp, err := searchGlobalAttributes(t, th.Client, byToken(model.GlobalAttributeListingSearch{}))
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		th.LoginBasic(t)
	})

	t.Run("a licence below Enterprise is refused with the generic endpoints' licence error", func(t *testing.T) {
		for name, license := range map[string]*model.License{
			"professional": model.NewTestLicenseSKU(model.LicenseShortSkuProfessional),
			"none":         nil,
		} {
			t.Run(name, func(t *testing.T) {
				if license == nil {
					require.Nil(t, th.App.Srv().RemoveLicense())
				} else {
					th.App.Srv().SetLicense(license)
				}
				t.Cleanup(func() {
					th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
				})

				_, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, byToken(model.GlobalAttributeListingSearch{}))
				require.Error(t, err)
				CheckForbiddenStatus(t, resp)
				CheckErrorID(t, err, "app.property.license_error")
			})
		}
	})

	t.Run("a non-admin without a licence is refused for permission, not licence", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		t.Cleanup(func() {
			th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		})

		_, resp, err := searchGlobalAttributes(t, th.Client, byToken(model.GlobalAttributeListingSearch{}))
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("invalid input is a bad request", func(t *testing.T) {
		for name, body := range map[string]string{
			"malformed JSON":      `{"term":`,
			"not JSON":            `term=abc`,
			"empty body":          ``,
			"wrong type for term": `{"term":5}`,
			"term too long":       `{"term":"` + strings.Repeat("a", model.PropertyFieldNameMaxRunes+1) + `"}`,
		} {
			t.Run(name, func(t *testing.T) {
				_, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, body)
				require.Error(t, err)
				CheckBadRequestStatus(t, resp)
				CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
			})
		}
	})

	t.Run("an empty object lists everything", func(t *testing.T) {
		listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, `{}`)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.GreaterOrEqual(t, len(listing.Rows), 4)
	})

	t.Run("the term matches ignoring case", func(t *testing.T) {
		listing, _, err := searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: strings.ToUpper(token) + "_BRAVO"}))
		require.NoError(t, err)
		require.Len(t, listing.Rows, 1)
		assert.Equal(t, token+"_bravo", listing.Rows[0].Field.Name)
	})

	t.Run("a term with LIKE wildcards matches them literally", func(t *testing.T) {
		listing, _, err := searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: "%"}))
		require.NoError(t, err)
		for _, row := range listing.Rows {
			assert.Contains(t, strings.ToLower(row.Field.Name+fmt.Sprint(row.Field.Attrs["display_name"])), "%")
		}
	})

	t.Run("a stored permissions object is withheld like the field endpoints withhold it from a v2 group", func(t *testing.T) {
		permissionsToken := "gaperm" + strings.ToLower(model.NewId()[:10])
		created, storeErr := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
			GroupID:    group.ID,
			Name:       permissionsToken,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
				},
				Grants: []model.Grant{{
					Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: model.NewId()},
					Allow:    []string{model.PropertyActionValueWrite},
				}},
			},
		})
		require.NoError(t, storeErr)
		require.NotNil(t, created.Permissions)

		listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: permissionsToken}))
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, listing.Rows, 1)
		assert.Equal(t, created.ID, listing.Rows[0].Field.ID)
		assert.Nil(t, listing.Rows[0].Field.Permissions)
	})

	t.Run("only POST is routed", func(t *testing.T) {
		r, err := th.SystemAdminClient.DoAPIRequestWithHeaders(context.Background(), http.MethodGet, th.SystemAdminClient.APIURL+globalAttributesSearchRoute, "", nil)
		if r != nil {
			defer r.Body.Close()
			assert.Equal(t, http.StatusNotFound, r.StatusCode, "the router answers an unrouted method like an unknown path")
		}
		require.Error(t, err)
	})
}

func TestSearchGlobalAttributeListingReturnsEveryRow(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	t.Cleanup(func() { _ = th.App.Srv().RemoveLicense() })

	token := "ga" + strings.ToLower(model.NewId()[:10])
	names := make([]string, model.AccessControlGroupFieldLimit)
	for i := range names {
		names[i] = fmt.Sprintf("t%03d", i)
	}
	seedListingTemplates(t, th, token, names...)

	listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: token}))
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.Len(t, listing.Rows, len(names))
	for i, row := range listing.Rows {
		assert.Equal(t, token+"_"+names[i], row.Field.Name)
	}
}

func TestSearchGlobalAttributeListingClassificationGating(t *testing.T) {
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() { _ = th.App.Srv().RemoveLicense() })

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	classification, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
		GroupID:    group.ID,
		Name:       "classification",
		Type:       model.PropertyFieldTypeRank,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})
	require.NoError(t, err)

	search := func(tb testing.TB) *model.GlobalAttributeListing {
		listing, _, err := searchGlobalAttributes(tb, th.SystemAdminClient, `{"term":"classification"}`)
		require.NoError(tb, err)
		return listing
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	assert.Empty(t, search(t).Rows, "Classification Markings needs Enterprise Advanced")

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	listing := search(t)
	require.Len(t, listing.Rows, 1)
	assert.Equal(t, classification.ID, listing.Rows[0].Field.ID)
	assert.True(t, listing.Rows[0].IsClassification)
}
