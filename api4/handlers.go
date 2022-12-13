// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/gziphandler"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/web"
)

type Context = web.Context

type handlerFunc func(*Context, http.ResponseWriter, *http.Request)

// APIHandler provides a handler for API endpoints which do not require the user to be logged in order for access to be
// granted.
func (api *API) APIHandler(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler
}

// APISessionRequired provides a handler for API endpoints which require the user to be logged in in order for access to
// be granted.
func (api *API) APISessionRequired(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     true,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler

}

// CloudAPIKeyRequired provides a handler for webhook endpoints to access Cloud installations from CWS
func (api *API) CloudAPIKeyRequired(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:             api.srv,
		HandleFunc:      h,
		HandlerName:     web.GetHandlerName(h),
		RequireSession:  false,
		RequireCloudKey: true,
		TrustRequester:  false,
		RequireMfa:      false,
		IsStatic:        false,
		IsLocal:         false,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler

}

// RemoteClusterTokenRequired provides a handler for remote cluster requests to /remotecluster endpoints.
func (api *API) RemoteClusterTokenRequired(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:                       api.srv,
		HandleFunc:                h,
		HandlerName:               web.GetHandlerName(h),
		RequireSession:            false,
		RequireCloudKey:           false,
		RequireRemoteClusterToken: true,
		TrustRequester:            false,
		RequireMfa:                false,
		IsStatic:                  false,
		IsLocal:                   false,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler
}

// APISessionRequiredMfa provides a handler for API endpoints which require a logged-in user session  but when accessed,
// if MFA is enabled, the MFA process is not yet complete, and therefore the requirement to have completed the MFA
// authentication must be waived.
func (api *API) APISessionRequiredMfa(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler

}

// APIHandlerTrustRequester provides a handler for API endpoints which do not require the user to be logged in and are
// allowed to be requested directly rather than via javascript/XMLHttpRequest, such as site branding images or the
// websocket.
func (api *API) APIHandlerTrustRequester(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: false,
		TrustRequester: true,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler

}

// APISessionRequiredTrustRequester provides a handler for API endpoints which do require the user to be logged in and
// are allowed to be requested directly rather than via javascript/XMLHttpRequest, such as emoji or file uploads.
func (api *API) APISessionRequiredTrustRequester(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: true,
		TrustRequester: true,
		RequireMfa:     true,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler

}

// DisableWhenBusy provides a handler for API endpoints which should be disabled when the server is under load,
// responding with HTTP 503 (Service Unavailable).
func (api *API) APISessionRequiredDisableWhenBusy(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:             api.srv,
		HandleFunc:      h,
		HandlerName:     web.GetHandlerName(h),
		RequireSession:  true,
		TrustRequester:  false,
		RequireMfa:      false,
		IsStatic:        false,
		IsLocal:         false,
		DisableWhenBusy: true,
	}
	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler

}

// APILocal provides a handler for API endpoints to be used in local
// mode, this is, through a UNIX socket and without an authenticated
// session, but with one that has no user set and no permission
// restrictions
func (api *API) APILocal(h handlerFunc) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        true,
	}

	if *api.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler
}

func requireLicense(c *Context) *model.AppError {
	if c.App.Channels().License() == nil {
		err := model.NewAppError("", "api.license_error", nil, "", http.StatusNotImplemented)
		return err
	}
	return nil
}

func minimumProfessionalLicense(c *Context) *model.AppError {
	lic := c.App.Srv().License()
	if lic == nil || (lic.SkuShortName != model.LicenseShortSkuProfessional && lic.SkuShortName != model.LicenseShortSkuEnterprise) {
		err := model.NewAppError("", model.NoTranslation, nil, "license is neither professional nor enterprise", http.StatusNotImplemented)
		return err
	}
	return nil
}

func requireEnterpriseLicense(c *Context) *model.AppError {
	lic := c.App.Srv().License()
	if lic == nil || lic.SkuShortName != model.LicenseShortSkuEnterprise {
		err := model.NewAppError("", model.NoTranslation, nil, "license is not enterprise", http.StatusNotImplemented)
		return err
	}
	return nil
}

func rejectGuests(c *Context) *model.AppError {
	if c.AppContext.Session().Props[model.SessionPropIsGuest] == "true" {
		err := model.NewAppError("", model.NoTranslation, nil, "insufficient permissions as a guest user", http.StatusNotImplemented)
		return err
	}
	return nil
}
