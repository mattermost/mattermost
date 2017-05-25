// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func LoadLicense() {
	utils.RemoveLicense()

	licenseId := ""
	if result := <-Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	if len(licenseId) != 26 {
		// Lets attempt to load the file from disk since it was missing from the DB
		license, licenseBytes := utils.GetAndValidateLicenseFileFromDisk()

		if license != nil {
			if _, err := SaveLicense(licenseBytes); err != nil {
				l4g.Info("Failed to save license key loaded from disk err=%v", err.Error())
			} else {
				licenseId = license.Id
			}
		}
	}

	if result := <-Srv.Store.License().Get(licenseId); result.Err == nil {
		record := result.Data.(*model.LicenseRecord)
		utils.LoadLicense([]byte(record.Bytes))
		l4g.Info("License key valid unlocking enterprise features.")
	} else {
		l4g.Info(utils.T("mattermost.load_license.find.warn"))
	}
}

func SaveLicense(licenseBytes []byte) (*model.License, *model.AppError) {
	var license *model.License

	if success, licenseStr := utils.ValidateLicense(licenseBytes); success {
		license = model.LicenseFromJson(strings.NewReader(licenseStr))

		if result := <-Srv.Store.User().AnalyticsUniqueUserCount(""); result.Err != nil {
			return nil, model.NewLocAppError("addLicense", "api.license.add_license.invalid_count.app_error", nil, result.Err.Error())
		} else {
			uniqueUserCount := result.Data.(int64)

			if uniqueUserCount > int64(*license.Features.Users) {
				return nil, model.NewLocAppError("addLicense", "api.license.add_license.unique_users.app_error", map[string]interface{}{"Users": *license.Features.Users, "Count": uniqueUserCount}, "")
			}
		}

		if ok := utils.SetLicense(license); !ok {
			return nil, model.NewLocAppError("addLicense", model.EXPIRED_LICENSE_ERROR, nil, "")
		}

		record := &model.LicenseRecord{}
		record.Id = license.Id
		record.Bytes = string(licenseBytes)
		rchan := Srv.Store.License().Save(record)

		if result := <-rchan; result.Err != nil {
			RemoveLicense()
			return nil, model.NewLocAppError("addLicense", "api.license.add_license.save.app_error", nil, "err="+result.Err.Error())
		}

		sysVar := &model.System{}
		sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
		sysVar.Value = license.Id
		schan := Srv.Store.System().SaveOrUpdate(sysVar)

		if result := <-schan; result.Err != nil {
			RemoveLicense()
			return nil, model.NewLocAppError("addLicense", "api.license.add_license.save_active.app_error", nil, "")
		}
	} else {
		return nil, model.NewLocAppError("addLicense", model.INVALID_LICENSE_ERROR, nil, "")
	}

	ReloadConfig()
	InvalidateAllCaches()

	return license, nil
}

func RemoveLicense() *model.AppError {
	utils.RemoveLicense()

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = ""

	if result := <-Srv.Store.System().SaveOrUpdate(sysVar); result.Err != nil {
		utils.RemoveLicense()
		return result.Err
	}

	ReloadConfig()

	InvalidateAllCaches()

	return nil
}
