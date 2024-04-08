// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	JWTDefaultTokenExpiration = 7 * 24 * time.Hour // 7 days of expiration
)

func (ch *Channels) License() *model.License {
	return ch.srv.License()
}

func (ch *Channels) RequestTrialLicenseWithExtraFields(requesterID string, trialRequest *model.TrialLicenseRequest) *model.AppError {
	if *ch.srv.platform.Config().ExperimentalSettings.RestrictSystemAdmin {
		return model.NewAppError("RequestTrialLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
	}

	requester, err := ch.srv.userService.GetUser(requesterID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("RequestTrialLicense", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("RequestTrialLicense", "app.user.get_by_username.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if ch.srv.Cloud.ValidateBusinessEmail(requesterID, trialRequest.ContactEmail) != nil {
		return model.NewAppError("RequestTrialLicense", "api.license.request-trial.bad-request.business-email", nil, "", http.StatusBadRequest)
	}

	// Create a new struct only using the fields from the request that are allowed to be set by the client
	sanitizedRequest := &model.TrialLicenseRequest{
		ServerID:              ch.srv.TelemetryId(),
		Name:                  requester.GetDisplayName(model.ShowFullName),
		Email:                 requester.Email,
		SiteName:              *ch.srv.platform.Config().TeamSettings.SiteName,
		SiteURL:               *ch.srv.platform.Config().ServiceSettings.SiteURL,
		Users:                 trialRequest.Users,
		TermsAccepted:         trialRequest.TermsAccepted,
		ReceiveEmailsAccepted: trialRequest.ReceiveEmailsAccepted,
		ContactName:           trialRequest.ContactName,
		ContactEmail:          trialRequest.ContactEmail,
		CompanyName:           trialRequest.CompanyName,
		CompanySize:           trialRequest.CompanySize,
		CompanyCountry:        trialRequest.CompanyCountry,
	}

	if !sanitizedRequest.IsValid() {
		return model.NewAppError("RequestTrialLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
	}

	return ch.srv.platform.RequestTrialLicense(sanitizedRequest)
}

// Deprecated: Use RequestTrialLicenseWithExtraFields instead. This function remains to support the Plugin API.
func (ch *Channels) RequestTrialLicense(requesterID string, users int, termsAccepted bool, receiveEmailsAccepted bool) *model.AppError {
	if *ch.srv.platform.Config().ExperimentalSettings.RestrictSystemAdmin {
		return model.NewAppError("RequestTrialLicense", "api.restricted_system_admin", nil, "", http.StatusForbidden)
	}

	if !termsAccepted {
		return model.NewAppError("RequestTrialLicense", "api.license.request-trial.bad-request.terms-not-accepted", nil, "", http.StatusBadRequest)
	}

	if users == 0 {
		return model.NewAppError("RequestTrialLicense", "api.license.request-trial.bad-request", nil, "", http.StatusBadRequest)
	}

	requester, err := ch.srv.userService.GetUser(requesterID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("RequestTrialLicense", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("RequestTrialLicense", "app.user.get_by_username.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	trialLicenseRequest := &model.TrialLicenseRequest{
		ServerID:              ch.srv.TelemetryId(),
		Name:                  requester.GetDisplayName(model.ShowFullName),
		Email:                 requester.Email,
		SiteName:              *ch.srv.platform.Config().TeamSettings.SiteName,
		SiteURL:               *ch.srv.platform.Config().ServiceSettings.SiteURL,
		Users:                 users,
		TermsAccepted:         termsAccepted,
		ReceiveEmailsAccepted: receiveEmailsAccepted,
	}

	return ch.srv.platform.RequestTrialLicense(trialLicenseRequest)
}

// JWTClaims custom JWT claims with the needed information for the
// renewal process
type JWTClaims struct {
	LicenseID   string `json:"license_id"`
	ActiveUsers int64  `json:"active_users"`
	jwt.RegisteredClaims
}

func (s *Server) License() *model.License {
	return s.platform.License()
}

func (s *Server) LoadLicense() {
	s.platform.LoadLicense()
}

func (s *Server) SaveLicense(licenseBytes []byte) (*model.License, *model.AppError) {
	return s.platform.SaveLicense(licenseBytes)
}

func (s *Server) SetLicense(license *model.License) bool {
	return s.platform.SetLicense(license)
}

func (s *Server) ValidateAndSetLicenseBytes(b []byte) error {
	return s.platform.ValidateAndSetLicenseBytes(b)
}

func (s *Server) SetClientLicense(m map[string]string) {
	s.platform.SetClientLicense(m)
}

func (s *Server) ClientLicense() map[string]string {
	return s.platform.ClientLicense()
}

func (s *Server) RemoveLicense() *model.AppError {
	return s.platform.RemoveLicense()
}

func (s *Server) AddLicenseListener(listener func(oldLicense, newLicense *model.License)) string {
	return s.platform.AddLicenseListener(listener)
}

func (s *Server) RemoveLicenseListener(id string) {
	s.platform.RemoveLicenseListener(id)
}

func (s *Server) GetSanitizedClientLicense() map[string]string {
	return s.platform.GetSanitizedClientLicense()
}

// GenerateRenewalToken returns a renewal token that expires after duration expiration
func (s *Server) GenerateRenewalToken(expiration time.Duration) (string, *model.AppError) {
	return s.platform.GenerateRenewalToken(expiration)
}

// GenerateLicenseRenewalLink returns a link that points to the CWS where clients can renew license
func (s *Server) GenerateLicenseRenewalLink() (string, string, *model.AppError) {
	return s.platform.GenerateLicenseRenewalLink()
}
