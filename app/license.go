// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	requestTrialURL = "https://customers.mattermost.com/api/v1/trials"
	LicenseEnv      = "MM_LICENSE"
)

func (s *Server) LoadLicense() {
	// ENV var overrides all other sources of license.
	licenseStr := os.Getenv(LicenseEnv)
	if licenseStr != "" {
		if s.ValidateAndSetLicenseBytes([]byte(licenseStr)) {
			mlog.Info("License key from ENV is valid, unlocking enterprise features.")
		}
		return
	}

	licenseId := ""
	props, nErr := s.Store.System().Get()
	if nErr == nil {
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	if !model.IsValidId(licenseId) {
		// Lets attempt to load the file from disk since it was missing from the DB
		license, licenseBytes := utils.GetAndValidateLicenseFileFromDisk(*s.Config().ServiceSettings.LicenseFileLocation)

		if license != nil {
			if _, err := s.SaveLicense(licenseBytes); err != nil {
				mlog.Info("Failed to save license key loaded from disk.", mlog.Err(err))
			} else {
				licenseId = license.Id
			}
		}
	}

	record, nErr := s.Store.License().Get(licenseId)
	if nErr != nil {
		mlog.Info("License key from https://mattermost.com required to unlock enterprise features.")
		s.SetLicense(nil)
		return
	}

	s.ValidateAndSetLicenseBytes([]byte(record.Bytes))
	mlog.Info("License key valid unlocking enterprise features.")
}

func (s *Server) SaveLicense(licenseBytes []byte) (*model.License, *model.AppError) {
	success, licenseStr := utils.ValidateLicense(licenseBytes)
	if !success {
		return nil, model.NewAppError("addLicense", model.INVALID_LICENSE_ERROR, nil, "", http.StatusBadRequest)
	}
	license := model.LicenseFromJson(strings.NewReader(licenseStr))

	uniqueUserCount, err := s.Store.User().Count(model.UserCountOptions{})
	if err != nil {
		return nil, model.NewAppError("addLicense", "api.license.add_license.invalid_count.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if uniqueUserCount > int64(*license.Features.Users) {
		return nil, model.NewAppError("addLicense", "api.license.add_license.unique_users.app_error", map[string]interface{}{"Users": *license.Features.Users, "Count": uniqueUserCount}, "", http.StatusBadRequest)
	}

	if license != nil && license.IsExpired() {
		return nil, model.NewAppError("addLicense", model.EXPIRED_LICENSE_ERROR, nil, "", http.StatusBadRequest)
	}

	if ok := s.SetLicense(license); !ok {
		return nil, model.NewAppError("addLicense", model.EXPIRED_LICENSE_ERROR, nil, "", http.StatusBadRequest)
	}

	record := &model.LicenseRecord{}
	record.Id = license.Id
	record.Bytes = string(licenseBytes)

	_, nErr := s.Store.License().Save(record)
	if nErr != nil {
		s.RemoveLicense()
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("addLicense", "api.license.add_license.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = license.Id
	if err := s.Store.System().SaveOrUpdate(sysVar); err != nil {
		s.RemoveLicense()
		return nil, model.NewAppError("addLicense", "api.license.add_license.save_active.app_error", nil, "", http.StatusInternalServerError)
	}

	s.ReloadConfig()
	s.InvalidateAllCaches()

	// start job server if necessary - this handles the edge case where a license file is uploaded, but the job server
	// doesn't start until the server is restarted, which prevents the 'run job now' buttons in system console from
	// functioning as expected
	if *s.Config().JobSettings.RunJobs && s.Jobs != nil && s.Jobs.Workers != nil {
		s.Jobs.StartWorkers()
	}
	if *s.Config().JobSettings.RunScheduler && s.Jobs != nil && s.Jobs.Schedulers != nil {
		s.Jobs.StartSchedulers()
	}

	return license, nil
}

func (s *Server) SetLicense(license *model.License) bool {
	oldLicense := s.licenseValue.Load()

	defer func() {
		for _, listener := range s.licenseListeners {
			if oldLicense == nil {
				listener(nil, license)
			} else {
				listener(oldLicense.(*model.License), license)
			}
		}
	}()

	if license != nil {
		license.Features.SetDefaults()

		s.licenseValue.Store(license)
		s.clientLicenseValue.Store(utils.GetClientLicense(license))
		return true
	}

	s.licenseValue.Store((*model.License)(nil))
	s.clientLicenseValue.Store(map[string]string(nil))
	return false
}

func (s *Server) ValidateAndSetLicenseBytes(b []byte) bool {
	if success, licenseStr := utils.ValidateLicense(b); success {
		license := model.LicenseFromJson(strings.NewReader(licenseStr))
		s.SetLicense(license)
		return true
	}

	mlog.Warn("No valid enterprise license found")
	return false
}

func (s *Server) SetClientLicense(m map[string]string) {
	s.clientLicenseValue.Store(m)
}

func (s *Server) ClientLicense() map[string]string {
	if clientLicense, _ := s.clientLicenseValue.Load().(map[string]string); clientLicense != nil {
		return clientLicense
	}
	return map[string]string{"IsLicensed": "false"}
}

func (s *Server) RemoveLicense() *model.AppError {
	if license, _ := s.licenseValue.Load().(*model.License); license == nil {
		return nil
	}

	mlog.Info("Remove license.", mlog.String("id", model.SYSTEM_ACTIVE_LICENSE_ID))

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = ""

	if err := s.Store.System().SaveOrUpdate(sysVar); err != nil {
		return model.NewAppError("RemoveLicense", "app.system.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	s.SetLicense(nil)
	s.ReloadConfig()
	s.InvalidateAllCaches()

	return nil
}

func (s *Server) AddLicenseListener(listener func(oldLicense, newLicense *model.License)) string {
	id := model.NewId()
	s.licenseListeners[id] = listener
	return id
}

func (s *Server) RemoveLicenseListener(id string) {
	delete(s.licenseListeners, id)
}

func (s *Server) GetSanitizedClientLicense() map[string]string {
	sanitizedLicense := make(map[string]string)

	for k, v := range s.ClientLicense() {
		sanitizedLicense[k] = v
	}

	delete(sanitizedLicense, "Id")
	delete(sanitizedLicense, "Name")
	delete(sanitizedLicense, "Email")
	delete(sanitizedLicense, "IssuedAt")
	delete(sanitizedLicense, "StartsAt")
	delete(sanitizedLicense, "ExpiresAt")
	delete(sanitizedLicense, "SkuName")
	delete(sanitizedLicense, "SkuShortName")

	return sanitizedLicense
}

// RequestTrialLicense request a trial license from the mattermost offical license server
func (s *Server) RequestTrialLicense(trialRequest *model.TrialLicenseRequest) *model.AppError {
	resp, err := http.Post(requestTrialURL, "application/json", bytes.NewBuffer([]byte(trialRequest.ToJson())))
	if err != nil {
		return model.NewAppError("RequestTrialLicense", "api.license.request_trial_license.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	defer resp.Body.Close()
	licenseResponse := model.MapFromJson(resp.Body)

	if _, ok := licenseResponse["license"]; !ok {
		return model.NewAppError("RequestTrialLicense", "api.license.request_trial_license.app_error", nil, licenseResponse["message"], http.StatusBadRequest)
	}

	if _, err := s.SaveLicense([]byte(licenseResponse["license"])); err != nil {
		return err
	}

	s.ReloadConfig()
	s.InvalidateAllCaches()

	return nil
}
