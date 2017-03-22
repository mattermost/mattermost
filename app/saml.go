// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"path/filepath"
)

func GetSamlMetadata() (string, *model.AppError) {
	samlInterface := einterfaces.GetSamlInterface()

	if samlInterface == nil {
		err := model.NewLocAppError("GetSamlMetadata", "api.admin.saml.not_available.app_error", nil, "")
		err.StatusCode = http.StatusNotImplemented
		return "", err
	}

	if result, err := samlInterface.GetMetadata(); err != nil {
		return "", model.NewLocAppError("GetSamlMetadata", "api.admin.saml.metadata.app_error", nil, "err="+err.Message)
	} else {
		return result, nil
	}
}

func AddSamlCertificate(fileData *multipart.FileHeader) *model.AppError {
	filename := filepath.Base(fileData.Filename)

	if filename == "." || filename == string(filepath.Separator) {
		return model.NewLocAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, "")
	}

	file, err := fileData.Open()
	defer file.Close()
	if err != nil {
		return model.NewLocAppError("AddSamlCertificate", "api.admin.add_certificate.open.app_error", nil, err.Error())
	}

	out, err := os.Create(utils.FindDir("config") + filename)
	if err != nil {
		return model.NewLocAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, err.Error())
	}
	defer out.Close()

	io.Copy(out, file)
	return nil
}

func RemoveSamlCertificate(filename string) *model.AppError {
	filename = filepath.Base(filename)

	if filename == "." || filename == string(filepath.Separator) {
		return model.NewLocAppError("AddSamlCertificate", "api.admin.remove_certificate.delete.app_error", nil, "")
	}

	if err := os.Remove(utils.FindConfigFile(filename)); err != nil {
		return model.NewLocAppError("removeCertificate", "api.admin.remove_certificate.delete.app_error",
			map[string]interface{}{"Filename": filename}, err.Error())
	}

	return nil
}

func GetSamlCertificateStatus() map[string]interface{} {
	status := make(map[string]interface{})

	status["IdpCertificateFile"] = utils.FileExistsInConfigFolder(*utils.Cfg.SamlSettings.IdpCertificateFile)
	status["PrivateKeyFile"] = utils.FileExistsInConfigFolder(*utils.Cfg.SamlSettings.PrivateKeyFile)
	status["PublicCertificateFile"] = utils.FileExistsInConfigFolder(*utils.Cfg.SamlSettings.PublicCertificateFile)

	return status
}
