// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

// oauthAttributeSyncSource returns the property sync source that user
// attributes are synced from at a sign-in through service, or "" when that
// service's sign-ins sync nothing. Only generic OpenID Connect does today.
// Another OAuth service becomes a source by being mapped here to a sync source
// of its own and by its provider implementing einterfaces.OAuthClaimsProvider.
func oauthAttributeSyncSource(service string) string {
	if service == model.ServiceOpenid {
		return model.PropertySyncSourceOpenID
	}
	return ""
}

// oauthAttributeSyncEnabled reports whether a sign-in through service syncs
// user attributes: the service is a sync source, the OpenIdAttributeSync kill
// switch is off, and the license covers it (the OpenId feature, and the
// Enterprise tier every write to user attributes requires).
func (a *App) oauthAttributeSyncEnabled(service string) bool {
	if oauthAttributeSyncSource(service) == "" || !a.Config().FeatureFlags.OpenIdAttributeSync {
		return false
	}
	license := a.License()
	return license != nil &&
		model.SafeDereference(license.Features.OpenId) &&
		model.MinimumEnterpriseLicense(license)
}

// syncOAuthUserAttributes writes the user attributes linked to claims of the
// identity provider the user just signed in with. It runs once the user is
// resolved and before the session is created, so the first request of the
// session is evaluated against fresh attributes.
//
// It never fails the sign-in. A sync that cannot run, or whose claims cannot
// be trusted, is logged and leaves every stored value as it is; the syncer
// itself logs the outcome of each attribute. Claim values are never logged.
func (a *App) syncOAuthUserAttributes(rctx request.CTX, service string, user *model.User, userInfo []byte, idToken string) {
	if user == nil || !a.oauthAttributeSyncEnabled(service) {
		return
	}
	provider, appErr := a.getSSOProvider(service)
	if appErr != nil {
		rctx.Logger().Warn("Failed to sync user attributes from the identity provider",
			mlog.String("service", service), mlog.String("user_id", user.Id), mlog.Err(appErr))
		return
	}
	a.syncUserAttributesFromClaims(rctx, provider, service, user, userInfo, idToken)
}

// syncUserAttributesFromClaims is syncOAuthUserAttributes once the sync is
// known to be enabled and the service's provider is resolved.
func (a *App) syncUserAttributesFromClaims(rctx request.CTX, provider einterfaces.OAuthProvider, service string, user *model.User, userInfo []byte, idToken string) {
	logger := rctx.Logger().With(mlog.String("service", service), mlog.String("user_id", user.Id))

	syncer, appErr := a.NewPropertySyncer(rctx, oauthAttributeSyncSource(service))
	if appErr != nil {
		logger.Warn("Failed to sync user attributes from the identity provider", mlog.Err(appErr))
		return
	}
	if !syncer.HasMappings() {
		return
	}

	claimsProvider, ok := provider.(einterfaces.OAuthClaimsProvider)
	if !ok {
		logger.Warn("Skipped syncing user attributes: the identity provider cannot report claims")
		return
	}

	values, err := claimsProvider.GetClaimValues(rctx, einterfaces.OAuthClaimsInput{
		Service:  service,
		UserInfo: userInfo,
		IDToken:  idToken,
		Config:   a.Config(),
	}, syncer.ExternalAttributes())
	if err != nil {
		logger.Warn("Skipped syncing user attributes: the identity provider's claims could not be verified", mlog.Err(err))
		return
	}

	result, appErr := syncer.SyncUser(rctx, user.Id, values, model.PropertySyncOptions{PruneOrphanedOptions: true})
	if appErr != nil {
		logger.Warn("Failed to sync user attributes from the identity provider", mlog.Err(appErr))
		return
	}
	logger.Debug("Synced user attributes from the identity provider",
		mlog.Int("updated", result.Count(model.PropertySyncFieldUpdated)),
		mlog.Int("unchanged", result.Count(model.PropertySyncFieldUnchanged)),
		mlog.Int("cleared", result.Count(model.PropertySyncFieldCleared)),
		mlog.Int("skipped", result.Count(model.PropertySyncFieldSkipped)),
		mlog.Int("failed", result.Count(model.PropertySyncFieldError)),
	)
}
