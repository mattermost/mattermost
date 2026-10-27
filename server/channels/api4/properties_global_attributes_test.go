// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

	t.Run("a system admin gets the rows and the total", func(t *testing.T) {
		listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, byToken(model.GlobalAttributeListingSearch{}))
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.EqualValues(t, 4, listing.TotalCount)
		names := make([]string, 0, len(listing.Rows))
		for _, row := range listing.Rows {
			names = append(names, row.Field.Name)
		}
		assert.Equal(t, []string{token + "_alpha", token + "_bravo", token + "_charlie", token + "_ldap_user"}, names)
	})

	t.Run("the response carries every row key, with lists as arrays", func(t *testing.T) {
		r, err := th.SystemAdminClient.DoAPIPost(context.Background(), globalAttributesSearchRoute, byToken(model.GlobalAttributeListingSearch{ResourceType: "user"}))
		require.NoError(t, err)
		defer r.Body.Close()

		var raw struct {
			Rows       []map[string]json.RawMessage `json:"rows"`
			TotalCount *int64                       `json:"total_count"`
		}
		require.NoError(t, json.NewDecoder(r.Body).Decode(&raw))
		require.NotNil(t, raw.TotalCount)
		require.Len(t, raw.Rows, 1)

		row := raw.Rows[0]
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
		assert.EqualValues(t, 4, listing.TotalCount)
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
			"unknown source":        `{"source":"bogus"}`,
			"unknown resource type": `{"resource_type":"team"}`,
			"template resource":     `{"resource_type":"template"}`,
			"negative page":         `{"page":-1}`,
			"malformed JSON":        `{"term":`,
			"not JSON":              `term=abc`,
			"empty body":            ``,
			"wrong type for page":   `{"page":"two"}`,
		} {
			t.Run(name, func(t *testing.T) {
				_, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, body)
				require.Error(t, err)
				CheckBadRequestStatus(t, resp)
				CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
			})
		}
	})

	t.Run("an empty object is the first page of everything with the default size", func(t *testing.T) {
		listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, `{}`)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.LessOrEqual(t, len(listing.Rows), model.GlobalAttributeListingPerPageDefault)
		assert.GreaterOrEqual(t, listing.TotalCount, int64(4))
	})

	t.Run("a zero or negative per_page falls back to the default", func(t *testing.T) {
		for _, perPage := range []int{0, -3} {
			listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, byToken(model.GlobalAttributeListingSearch{PerPage: perPage}))
			require.NoError(t, err, "per_page %d", perPage)
			CheckOKStatus(t, resp)
			assert.Len(t, listing.Rows, 4)
		}
	})

	t.Run("pages are consecutive and the total is the same on each", func(t *testing.T) {
		var names []string
		for page, expectedLen := range []int{3, 1, 0} {
			listing, _, err := searchGlobalAttributes(t, th.SystemAdminClient, byToken(model.GlobalAttributeListingSearch{Page: page, PerPage: 3}))
			require.NoError(t, err)
			assert.Len(t, listing.Rows, expectedLen, "page %d", page)
			assert.EqualValues(t, 4, listing.TotalCount, "page %d", page)
			for _, row := range listing.Rows {
				names = append(names, row.Field.Name)
			}
		}
		assert.Equal(t, []string{token + "_alpha", token + "_bravo", token + "_charlie", token + "_ldap_user"}, names)
	})

	t.Run("a page past the end is an empty array with the total intact", func(t *testing.T) {
		r, err := th.SystemAdminClient.DoAPIPost(context.Background(), globalAttributesSearchRoute, byToken(model.GlobalAttributeListingSearch{Page: 50, PerPage: 3}))
		require.NoError(t, err)
		defer r.Body.Close()
		var raw map[string]json.RawMessage
		require.NoError(t, json.NewDecoder(r.Body).Decode(&raw))
		assert.JSONEq(t, `[]`, string(raw["rows"]))
		assert.JSONEq(t, `4`, string(raw["total_count"]))
	})

	t.Run("term, source and resource type filter together and move the total", func(t *testing.T) {
		listing, _, err := searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: "BRAVO"}))
		require.NoError(t, err)
		require.Len(t, listing.Rows, 1)
		assert.Equal(t, token+"_bravo", listing.Rows[0].Field.Name)
		assert.EqualValues(t, 1, listing.TotalCount)

		listing, _, err = searchGlobalAttributes(t, th.SystemAdminClient, byToken(model.GlobalAttributeListingSearch{Source: model.GlobalAttributeSourceLDAP}))
		require.NoError(t, err)
		require.Len(t, listing.Rows, 1)
		assert.Equal(t, token+"_ldap_user", listing.Rows[0].Field.Name)

		listing, _, err = searchGlobalAttributes(t, th.SystemAdminClient, byToken(model.GlobalAttributeListingSearch{Source: model.GlobalAttributeSourceManaged, ResourceType: model.PropertyFieldObjectTypeUser}))
		require.NoError(t, err)
		assert.Empty(t, listing.Rows, "the only user field is LDAP-synced")
		assert.EqualValues(t, 0, listing.TotalCount)
	})

	t.Run("a term with LIKE wildcards matches them literally", func(t *testing.T) {
		listing, _, err := searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: "%"}))
		require.NoError(t, err)
		for _, row := range listing.Rows {
			assert.Contains(t, strings.ToLower(row.Field.Name+fmt.Sprint(row.Field.Attrs["display_name"])), "%")
		}
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

func TestSearchGlobalAttributeListingPerPageClamp(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	t.Cleanup(func() { _ = th.App.Srv().RemoveLicense() })

	token := "ga" + strings.ToLower(model.NewId()[:10])
	names := make([]string, model.GlobalAttributeListingPerPageMaximum+1)
	for i := range names {
		names[i] = fmt.Sprintf("t%03d", i)
	}
	seedListingTemplates(t, th, token, names...)

	listing, resp, err := searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: token, PerPage: 100000}))
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	assert.Len(t, listing.Rows, model.GlobalAttributeListingPerPageMaximum)
	assert.EqualValues(t, model.GlobalAttributeListingPerPageMaximum+1, listing.TotalCount)

	listing, _, err = searchGlobalAttributes(t, th.SystemAdminClient, searchGlobalAttributesBody(t, model.GlobalAttributeListingSearch{Term: token, Page: 1, PerPage: 100000}))
	require.NoError(t, err)
	assert.Len(t, listing.Rows, 1, "page 1 starts after the clamped size")
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
