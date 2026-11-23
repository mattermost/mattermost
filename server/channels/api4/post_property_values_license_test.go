// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

const postAttributesLicenseErrorID = "api.property.post_attributes.license.app_error"

// postReadSite is one endpoint that resolves the propertyGroup parameter.
type postReadSite struct {
	name string
	path func(t *testing.T, th *postPropertyTestHelper) string
}

// postReadSites lists every handler that calls resolvePropertyGroupParam, so a new one
// that skips the licence gate is caught by adding it here.
func postReadSites() []postReadSite {
	return []postReadSite{
		{
			name: "getPostsForChannel default branch",
			path: func(t *testing.T, th *postPropertyTestHelper) string {
				return fmt.Sprintf("/channels/%s/posts?page=0&per_page=60", th.BasicChannel.Id)
			},
		},
		{
			name: "getPostsForChannel after branch",
			path: func(t *testing.T, th *postPropertyTestHelper) string {
				return fmt.Sprintf("/channels/%s/posts?after=%s&page=0&per_page=60", th.BasicChannel.Id, th.BasicPost.Id)
			},
		},
		{
			name: "getPostsForChannel before branch",
			path: func(t *testing.T, th *postPropertyTestHelper) string {
				return fmt.Sprintf("/channels/%s/posts?before=%s&page=0&per_page=60", th.BasicChannel.Id, th.BasicPost.Id)
			},
		},
		{
			name: "getPostsForChannelAroundLastUnread",
			path: func(t *testing.T, th *postPropertyTestHelper) string {
				return fmt.Sprintf("/users/%s/channels/%s/posts/unread?limit_before=30&limit_after=30",
					th.BasicUser.Id, th.BasicChannel.Id)
			},
		},
		{
			name: "getPost",
			path: func(t *testing.T, th *postPropertyTestHelper) string {
				return fmt.Sprintf("/posts/%s", th.BasicPost.Id)
			},
		},
		{
			name: "getPostThread",
			path: func(t *testing.T, th *postPropertyTestHelper) string {
				return fmt.Sprintf("/posts/%s/thread", th.BasicPost.Id)
			},
		},
		{
			name: "getPostsForView",
			path: func(t *testing.T, th *postPropertyTestHelper) string {
				view, _, err := th.Client.CreateView(context.Background(), th.BasicChannel.Id, makeTestViewForAPI(t))
				require.NoError(t, err)
				return fmt.Sprintf("/channels/%s/views/%s/posts", th.BasicChannel.Id, view.Id)
			},
		},
	}
}

func setupPostReadLicenseTest(t *testing.T) *postPropertyTestHelper {
	t.Helper()
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostAttributes = true
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	return &postPropertyTestHelper{TestHelper: th}
}

// getStatus issues a raw GET and returns the status code and, for a refused request, the id of
// the AppError in the body. The client returns that error for any status of 300 or more, so
// th.get cannot be used where a refusal is the expected outcome.
func getStatus(t *testing.T, th *postPropertyTestHelper, path string) (int, string) {
	t.Helper()
	resp, err := th.Client.DoAPIGet(context.Background(), path, "")
	require.NotNil(t, resp)
	if err == nil {
		_ = resp.Body.Close()
		return resp.StatusCode, ""
	}
	var appErr *model.AppError
	require.ErrorAs(t, err, &appErr)
	return resp.StatusCode, appErr.Id
}

// TestPostReadPropertyGroupLicenseGate covers the 501 that stops a post read from asking
// to hydrate access_control without an Enterprise licence. Without it the licence hook
// refuses every hydration read and every post comes back property_values_unavailable.
func TestPostReadPropertyGroupLicenseGate(t *testing.T) {
	mainHelper.Parallel(t)

	for _, site := range postReadSites() {
		t.Run(site.name, func(t *testing.T) {
			th := setupPostReadLicenseTest(t)
			path := site.path(t, th)

			t.Run("unlicensed with access_control is refused with 501", func(t *testing.T) {
				th.App.Srv().SetLicense(nil)

				status, id := getStatus(t, th, withGroup(path))
				require.Equal(t, http.StatusNotImplemented, status)
				assert.Equal(t, postAttributesLicenseErrorID, id)
			})

			t.Run("licensed with access_control is served", func(t *testing.T) {
				th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

				status, _ := getStatus(t, th, withGroup(path))
				assert.Equal(t, http.StatusOK, status)
			})

			t.Run("unlicensed without propertyGroup is unchanged", func(t *testing.T) {
				th.App.Srv().SetLicense(nil)

				status, _ := getStatus(t, th, path)
				assert.Equal(t, http.StatusOK, status)
			})

			t.Run("unlicensed with a v2 group other than access_control is not gated", func(t *testing.T) {
				th.App.Srv().SetLicense(nil)

				status, _ := getStatus(t, th, withGroupName(path, model.BoardsPropertyGroupName))
				assert.Equal(t, http.StatusOK, status)
			})
		})
	}
}

// TestPostReadPropertyGroupLicenseTier pins which licences count as Enterprise for the
// gate: it follows model.MinimumEnterpriseLicense, which accepts Entry (tier 30) because
// the tier number sits above Enterprise (20), and rejects Professional (10).
func TestPostReadPropertyGroupLicenseTier(t *testing.T) {
	mainHelper.Parallel(t)

	tiers := []struct {
		name     string
		license  *model.License
		expected int
	}{
		{"professional is refused", model.NewTestLicenseSKU(model.LicenseShortSkuProfessional), http.StatusNotImplemented},
		{"enterprise is served", model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise), http.StatusOK},
		{"entry is served", model.NewTestLicenseSKU(model.LicenseShortSkuMattermostEntry), http.StatusOK},
		{"enterprise advanced is served", model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced), http.StatusOK},
		// NewTestLicense leaves the SKU empty, which maps to no tier.
		{"a licence without a SKU is refused", model.NewTestLicense(), http.StatusNotImplemented},
	}

	for _, tier := range tiers {
		t.Run(tier.name, func(t *testing.T) {
			th := setupPostReadLicenseTest(t)
			th.App.Srv().SetLicense(tier.license)

			path := fmt.Sprintf("/channels/%s/posts?page=0&per_page=60", th.BasicChannel.Id)
			status, _ := getStatus(t, th, withGroup(path))
			assert.Equal(t, tier.expected, status)
		})
	}
}
