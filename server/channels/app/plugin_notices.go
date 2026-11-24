// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/Masterminds/semver/v3"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// TranslationId marks a string literal as an i18n id so the extractor picks it up.
func TranslationId(id string) string {
	return id
}

type pluginNoticeContext struct {
	Manifest *model.Manifest
	// Version is nil when the manifest version does not parse.
	Version *semver.Version
	// License is nil when the server is unlicensed.
	License *model.License
}

type pluginNoticeCondition func(pluginNoticeContext) bool

type pluginNoticeRule struct {
	PluginID string
	// Conditions must all match for the rule to apply.
	Conditions []pluginNoticeCondition
	Deprecated bool
	// StatusID is an optional i18n id for the status label override.
	StatusID  string
	MessageID string
}

// versionMatches matches when the installed plugin version satisfies the semver
// constraint. It panics on an invalid constraint so mistakes surface at init.
func versionMatches(constraint string) pluginNoticeCondition {
	c, err := semver.NewConstraint(constraint)
	if err != nil {
		panic("invalid plugin notice version constraint " + constraint + ": " + err.Error())
	}

	return func(ctx pluginNoticeContext) bool {
		return ctx.Version != nil && c.Check(ctx.Version)
	}
}

func licenseSKU(skus ...string) pluginNoticeCondition {
	return func(ctx pluginNoticeContext) bool {
		if ctx.License == nil {
			return false
		}
		for _, sku := range skus {
			if ctx.License.SkuShortName == sku {
				return true
			}
		}
		return false
	}
}

func minimumLicenseTier(tier int) pluginNoticeCondition {
	return func(ctx pluginNoticeContext) bool {
		return ctx.License != nil && model.LicenseToLicenseTier[ctx.License.SkuShortName] >= tier
	}
}

// belowLicenseTier matches licensed servers under the tier; unlicensed servers
// do not match.
func belowLicenseTier(tier int) pluginNoticeCondition {
	return func(ctx pluginNoticeContext) bool {
		return ctx.License != nil && model.LicenseToLicenseTier[ctx.License.SkuShortName] < tier
	}
}

func unlicensed() pluginNoticeCondition {
	return func(ctx pluginNoticeContext) bool {
		return ctx.License == nil
	}
}

func not(cond pluginNoticeCondition) pluginNoticeCondition {
	return func(ctx pluginNoticeContext) bool {
		return !cond(ctx)
	}
}

func anyOf(conds ...pluginNoticeCondition) pluginNoticeCondition {
	return func(ctx pluginNoticeContext) bool {
		for _, cond := range conds {
			if cond(ctx) {
				return true
			}
		}
		return false
	}
}

// pluginNoticeRules is ordered: the first matching rule for a plugin wins, so
// more specific rules go first.
var pluginNoticeRules = []pluginNoticeRule{
	{
		PluginID:   model.PluginIdPlaybooks,
		Conditions: []pluginNoticeCondition{versionMatches("< 2.0.0")},
		Deprecated: true,
		MessageID:  TranslationId("app.plugin.notice.playbooks_v1_deprecated"),
	},
	{
		PluginID:   model.PluginIdPlaybooks,
		Conditions: []pluginNoticeCondition{licenseSKU(model.LicenseShortSkuProfessional)},
		StatusID:   TranslationId("app.plugin.notice.status.unsupported"),
		MessageID:  TranslationId("app.plugin.notice.playbooks_professional_unsupported"),
	},
}

func (r pluginNoticeRule) matches(ctx pluginNoticeContext) bool {
	if r.PluginID != ctx.Manifest.Id {
		return false
	}
	for _, cond := range r.Conditions {
		if !cond(ctx) {
			return false
		}
	}
	return true
}

// pluginNoticeFor returns the notice for one manifest, or nil.
func pluginNoticeFor(manifest *model.Manifest, license *model.License, T i18n.TranslateFunc) *model.PluginNotice {
	if manifest == nil {
		return nil
	}

	ctx := pluginNoticeContext{Manifest: manifest, License: license}
	if v, err := semver.NewVersion(manifest.Version); err == nil {
		ctx.Version = v
	}

	for _, rule := range pluginNoticeRules {
		if !rule.matches(ctx) {
			continue
		}

		notice := &model.PluginNotice{
			Deprecated: rule.Deprecated,
			Message:    T(rule.MessageID),
		}
		if rule.StatusID != "" {
			notice.Status = T(rule.StatusID)
		}
		return notice
	}

	return nil
}

// AttachPluginNotices sets the notice on every plugin in the response using the
// server license and the request's translator.
func (a *App) AttachPluginNotices(rctx request.CTX, resp *model.PluginsResponse) {
	if resp == nil {
		return
	}

	license := a.Srv().License()
	T := rctx.T
	for _, list := range [][]*model.PluginInfo{resp.Active, resp.Inactive} {
		for _, info := range list {
			if info == nil {
				continue
			}
			info.Notice = pluginNoticeFor(&info.Manifest, license, T)
		}
	}
}
