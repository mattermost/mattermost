// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/md5"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) LoadLicense() {
	a.SetLicense(nil)

	licenseId := ""
	if result := <-a.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	if len(licenseId) != 26 {
		// Lets attempt to load the file from disk since it was missing from the DB
		license, licenseBytes := utils.GetAndValidateLicenseFileFromDisk(*a.Config().ServiceSettings.LicenseFileLocation)

		if license != nil {
			if _, err := a.SaveLicense(licenseBytes); err != nil {
				mlog.Info(fmt.Sprintf("Failed to save license key loaded from disk err=%v", err.Error()))
			} else {
				licenseId = license.Id
			}
		}
	}

	if result := <-a.Srv.Store.License().Get(licenseId); result.Err == nil {
		record := result.Data.(*model.LicenseRecord)
		a.ValidateAndSetLicenseBytes([]byte(record.Bytes))
		mlog.Info("License key valid unlocking enterprise features.")
	} else {
		mlog.Info("License key from https://mattermost.com required to unlock enterprise features.")
	}
}

func (a *App) SaveLicense(licenseBytes []byte) (*model.License, *model.AppError) {
	success, licenseStr := utils.ValidateLicense(licenseBytes)
	if !success {
		return nil, model.NewAppError("addLicense", model.INVALID_LICENSE_ERROR, nil, "", http.StatusBadRequest)
	}
	license := model.LicenseFromJson(strings.NewReader(licenseStr))

	result := <-a.Srv.Store.User().AnalyticsUniqueUserCount("")
	if result.Err != nil {
		return nil, model.NewAppError("addLicense", "api.license.add_license.invalid_count.app_error", nil, result.Err.Error(), http.StatusBadRequest)
	}
	uniqueUserCount := result.Data.(int64)

	if uniqueUserCount > int64(*license.Features.Users) {
		return nil, model.NewAppError("addLicense", "api.license.add_license.unique_users.app_error", map[string]interface{}{"Users": *license.Features.Users, "Count": uniqueUserCount}, "", http.StatusBadRequest)
	}

	if ok := a.SetLicense(license); !ok {
		return nil, model.NewAppError("addLicense", model.EXPIRED_LICENSE_ERROR, nil, "", http.StatusBadRequest)
	}

	record := &model.LicenseRecord{}
	record.Id = license.Id
	record.Bytes = string(licenseBytes)
	rchan := a.Srv.Store.License().Save(record)

	if result := <-rchan; result.Err != nil {
		a.RemoveLicense()
		return nil, model.NewAppError("addLicense", "api.license.add_license.save.app_error", nil, "err="+result.Err.Error(), http.StatusInternalServerError)
	}

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = license.Id
	schan := a.Srv.Store.System().SaveOrUpdate(sysVar)

	if result := <-schan; result.Err != nil {
		a.RemoveLicense()
		return nil, model.NewAppError("addLicense", "api.license.add_license.save_active.app_error", nil, "", http.StatusInternalServerError)
	}

	a.ReloadConfig()
	a.InvalidateAllCaches()

	// start job server if necessary - this handles the edge case where a license file is uploaded, but the job server
	// doesn't start until the server is restarted, which prevents the 'run job now' buttons in system console from
	// functioning as expected
	if *a.Config().JobSettings.RunJobs {
		a.Jobs.StartWorkers()
	}
	if *a.Config().JobSettings.RunScheduler {
		a.Jobs.StartSchedulers()
	}

	return license, nil
}

// License returns the currently active license or nil if the application is unlicensed.
func (a *App) License() *model.License {
	license, _ := a.licenseValue.Load().(*model.License)
	return license
}

func (a *App) SetLicense(license *model.License) bool {
	defer func() {
		for _, listener := range a.licenseListeners {
			listener()
		}
	}()

	if license != nil {
		license.Features.SetDefaults()

		if !license.IsExpired() {
			a.licenseValue.Store(license)
			a.clientLicenseValue.Store(utils.GetClientLicense(license))
			return true
		}
	}

	a.licenseValue.Store((*model.License)(nil))
	a.clientLicenseValue.Store(map[string]string(nil))
	return false
}

func (a *App) ValidateAndSetLicenseBytes(b []byte) {
	if success, licenseStr := utils.ValidateLicense(b); success {
		license := model.LicenseFromJson(strings.NewReader(licenseStr))
		a.SetLicense(license)
		return
	}

	mlog.Warn("No valid enterprise license found")
}

func (a *App) SetClientLicense(m map[string]string) {
	a.clientLicenseValue.Store(m)
}

func (a *App) ClientLicense() map[string]string {
	if clientLicense, _ := a.clientLicenseValue.Load().(map[string]string); clientLicense != nil {
		return clientLicense
	}
	return map[string]string{"IsLicensed": "false"}
}

func (a *App) RemoveLicense() *model.AppError {
	if license, _ := a.licenseValue.Load().(*model.License); license == nil {
		return nil
	}

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = ""

	if result := <-a.Srv.Store.System().SaveOrUpdate(sysVar); result.Err != nil {
		return result.Err
	}

	a.SetLicense(nil)
	a.ReloadConfig()

	a.InvalidateAllCaches()

	return nil
}

func (a *App) AddLicenseListener(listener func()) string {
	id := model.NewId()
	a.licenseListeners[id] = listener
	return id
}

func (a *App) RemoveLicenseListener(id string) {
	delete(a.licenseListeners, id)
}

func (a *App) GetClientLicenseEtag(useSanitized bool) string {
	value := ""

	lic := a.ClientLicense()

	if useSanitized {
		lic = a.GetSanitizedClientLicense()
	}

	for k, v := range lic {
		value += fmt.Sprintf("%s:%s;", k, v)
	}

	return model.Etag(fmt.Sprintf("%x", md5.Sum([]byte(value))))
}

func (a *App) GetSanitizedClientLicense() map[string]string {
	sanitizedLicense := make(map[string]string)

	for k, v := range a.ClientLicense() {
		sanitizedLicense[k] = v
	}

	delete(sanitizedLicense, "Id")
	delete(sanitizedLicense, "Name")
	delete(sanitizedLicense, "Email")
	delete(sanitizedLicense, "PhoneNumber")
	delete(sanitizedLicense, "IssuedAt")
	delete(sanitizedLicense, "StartsAt")
	delete(sanitizedLicense, "ExpiresAt")

	return sanitizedLicense
}
