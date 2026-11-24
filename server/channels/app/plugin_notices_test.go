// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/Masterminds/semver/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func testNoticeTranslate(id string, _ ...any) string {
	return "translated:" + id
}

func noticeTestLicense(sku string) *model.License {
	if sku == "" {
		return nil
	}
	return &model.License{SkuShortName: sku}
}

func TestPluginNoticeFor(t *testing.T) {
	v1Notice := &model.PluginNotice{
		Deprecated: true,
		Message:    "translated:app.plugin.notice.playbooks_v1_deprecated",
	}
	professionalNotice := &model.PluginNotice{
		Status:  "translated:app.plugin.notice.status.unsupported",
		Message: "translated:app.plugin.notice.playbooks_professional_unsupported",
	}

	tests := []struct {
		name     string
		pluginID string
		version  string
		sku      string
		expected *model.PluginNotice
	}{
		{"playbooks 1.x unlicensed", model.PluginIdPlaybooks, "1.40.0", "", v1Notice},
		{"playbooks 1.x enterprise", model.PluginIdPlaybooks, "1.40.0", model.LicenseShortSkuEnterprise, v1Notice},
		{"playbooks 1.x professional takes v1 rule by ordering", model.PluginIdPlaybooks, "1.40.0", model.LicenseShortSkuProfessional, v1Notice},
		{"playbooks 1.x v-prefixed", model.PluginIdPlaybooks, "v1.2.3", "", v1Notice},
		{"playbooks 2.x professional", model.PluginIdPlaybooks, "2.0.0", model.LicenseShortSkuProfessional, professionalNotice},
		{"playbooks 2.x enterprise", model.PluginIdPlaybooks, "2.1.0", model.LicenseShortSkuEnterprise, nil},
		{"playbooks 2.x advanced", model.PluginIdPlaybooks, "2.1.0", model.LicenseShortSkuEnterpriseAdvanced, nil},
		{"playbooks 2.x entry", model.PluginIdPlaybooks, "2.1.0", model.LicenseShortSkuMattermostEntry, nil},
		{"playbooks 2.x unlicensed", model.PluginIdPlaybooks, "2.1.0", "", nil},
		{"playbooks unparseable version enterprise", model.PluginIdPlaybooks, "not-a-version", model.LicenseShortSkuEnterprise, nil},
		{"playbooks unparseable version professional", model.PluginIdPlaybooks, "not-a-version", model.LicenseShortSkuProfessional, professionalNotice},
		{"playbooks empty version professional", model.PluginIdPlaybooks, "", model.LicenseShortSkuProfessional, professionalNotice},
		{"other plugin 1.x", "com.example.other", "1.0.0", model.LicenseShortSkuProfessional, nil},
		{"other plugin 2.x", "com.example.other", "2.0.0", "", nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			manifest := &model.Manifest{Id: tc.pluginID, Version: tc.version}
			notice := pluginNoticeFor(manifest, noticeTestLicense(tc.sku), testNoticeTranslate)
			assert.Equal(t, tc.expected, notice)
		})
	}

	t.Run("nil manifest", func(t *testing.T) {
		assert.Nil(t, pluginNoticeFor(nil, nil, testNoticeTranslate))
	})
}

func TestPluginNoticeConditions(t *testing.T) {
	ctxWith := func(version, sku string) pluginNoticeContext {
		ctx := pluginNoticeContext{Manifest: &model.Manifest{Id: "x", Version: version}, License: noticeTestLicense(sku)}
		if v, err := semver.NewVersion(version); err == nil {
			ctx.Version = v
		}
		return ctx
	}

	t.Run("versionMatches", func(t *testing.T) {
		cond := versionMatches("< 2.0.0")
		assert.True(t, cond(ctxWith("1.9.9", "")))
		assert.True(t, cond(ctxWith("0.1.0", "")))
		assert.False(t, cond(ctxWith("2.0.0", "")))
		assert.False(t, cond(ctxWith("3.0.0", "")))
		assert.False(t, cond(ctxWith("garbage", "")))
	})

	t.Run("versionMatches panics on invalid constraint", func(t *testing.T) {
		require.Panics(t, func() { versionMatches("not a constraint") })
	})

	t.Run("licenseSKU", func(t *testing.T) {
		cond := licenseSKU(model.LicenseShortSkuProfessional, model.LicenseShortSkuMattermostEntry)
		assert.True(t, cond(ctxWith("1.0.0", model.LicenseShortSkuProfessional)))
		assert.True(t, cond(ctxWith("1.0.0", model.LicenseShortSkuMattermostEntry)))
		assert.False(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterprise)))
		assert.False(t, cond(ctxWith("1.0.0", "")))
	})

	t.Run("minimumLicenseTier", func(t *testing.T) {
		cond := minimumLicenseTier(model.EnterpriseTier)
		assert.False(t, cond(ctxWith("1.0.0", "")))
		assert.False(t, cond(ctxWith("1.0.0", model.LicenseShortSkuProfessional)))
		assert.True(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterprise)))
		assert.True(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterpriseAdvanced)))
	})

	t.Run("belowLicenseTier", func(t *testing.T) {
		cond := belowLicenseTier(model.EnterpriseTier)
		assert.False(t, cond(ctxWith("1.0.0", "")))
		assert.True(t, cond(ctxWith("1.0.0", model.LicenseShortSkuProfessional)))
		assert.False(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterprise)))
		assert.False(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterpriseAdvanced)))
	})

	t.Run("unlicensed", func(t *testing.T) {
		cond := unlicensed()
		assert.True(t, cond(ctxWith("1.0.0", "")))
		assert.False(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterprise)))
	})

	t.Run("not", func(t *testing.T) {
		cond := not(unlicensed())
		assert.False(t, cond(ctxWith("1.0.0", "")))
		assert.True(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterprise)))
	})

	t.Run("anyOf", func(t *testing.T) {
		cond := anyOf(unlicensed(), licenseSKU(model.LicenseShortSkuProfessional))
		assert.True(t, cond(ctxWith("1.0.0", "")))
		assert.True(t, cond(ctxWith("1.0.0", model.LicenseShortSkuProfessional)))
		assert.False(t, cond(ctxWith("1.0.0", model.LicenseShortSkuEnterprise)))
		assert.False(t, anyOf()(ctxWith("1.0.0", "")))
	})
}

func TestAttachPluginNotices(t *testing.T) {
	th := Setup(t)

	resp := &model.PluginsResponse{
		Active: []*model.PluginInfo{
			{Manifest: model.Manifest{Id: model.PluginIdPlaybooks, Version: "1.0.0"}},
		},
		Inactive: []*model.PluginInfo{
			{Manifest: model.Manifest{Id: "com.example.other", Version: "1.0.0"}},
			{Manifest: model.Manifest{Id: model.PluginIdPlaybooks, Version: "2.0.0"}},
		},
	}

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
	th.App.AttachPluginNotices(th.Context, resp)

	require.NotNil(t, resp.Active[0].Notice)
	assert.True(t, resp.Active[0].Notice.Deprecated)
	assert.NotEmpty(t, resp.Active[0].Notice.Message)
	assert.Nil(t, resp.Inactive[0].Notice)
	require.NotNil(t, resp.Inactive[1].Notice)
	assert.False(t, resp.Inactive[1].Notice.Deprecated)
	assert.Equal(t, "Unsupported", resp.Inactive[1].Notice.Status)

	th.App.AttachPluginNotices(th.Context, nil)
}
