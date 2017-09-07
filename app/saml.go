// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"

	"path/filepath"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func GetSamlMetadata() (string, *model.AppError) {
	samlInterface := einterfaces.GetSamlInterface()
	if samlInterface == nil {
		err := model.NewAppError("GetSamlMetadata", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return "", err
	}

	if result, err := samlInterface.GetMetadata(); err != nil {
		return "", model.NewAppError("GetSamlMetadata", "api.admin.saml.metadata.app_error", nil, "err="+err.Message, err.StatusCode)
	} else {
		return result, nil
	}
}

func WriteSamlFile(fileData *multipart.FileHeader) *model.AppError {
	filename := filepath.Base(fileData.Filename)

	if filename == "." || filename == string(filepath.Separator) {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusBadRequest)
	}

	file, err := fileData.Open()
	defer file.Close()
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.open.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	configDir, _ := utils.FindDir("config")
	out, err := os.Create(configDir + filename)
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer out.Close()

	io.Copy(out, file)
	return nil
}

func AddSamlPublicCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(fileData); err != nil {
		return err
	}

	cfg := &model.Config{}
	*cfg = *utils.Cfg

	*cfg.SamlSettings.PublicCertificateFile = fileData.Filename

	if err := cfg.IsValid(); err != nil {
		return err
	}

	utils.SaveConfig(utils.CfgFileName, cfg)

	return nil
}

func AddSamlPrivateCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(fileData); err != nil {
		return err
	}

	cfg := &model.Config{}
	*cfg = *utils.Cfg

	*cfg.SamlSettings.PrivateKeyFile = fileData.Filename

	if err := cfg.IsValid(); err != nil {
		return err
	}

	utils.SaveConfig(utils.CfgFileName, cfg)

	return nil
}

func AddSamlIdpCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(fileData); err != nil {
		return err
	}

	cfg := &model.Config{}
	*cfg = *utils.Cfg

	*cfg.SamlSettings.IdpCertificateFile = fileData.Filename

	if err := cfg.IsValid(); err != nil {
		return err
	}

	utils.SaveConfig(utils.CfgFileName, cfg)

	return nil
}

func RemoveSamlFile(filename string) *model.AppError {
	filename = filepath.Base(filename)

	if filename == "." || filename == string(filepath.Separator) {
		return model.NewAppError("AddSamlCertificate", "api.admin.remove_certificate.delete.app_error", nil, "", http.StatusBadRequest)
	}

	if err := os.Remove(utils.FindConfigFile(filename)); err != nil {
		return model.NewAppError("removeCertificate", "api.admin.remove_certificate.delete.app_error", map[string]interface{}{"Filename": filename}, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func RemoveSamlPublicCertificate() *model.AppError {
	if err := RemoveSamlFile(*utils.Cfg.SamlSettings.PublicCertificateFile); err != nil {
		return err
	}

	cfg := &model.Config{}
	*cfg = *utils.Cfg

	*cfg.SamlSettings.PublicCertificateFile = ""
	*cfg.SamlSettings.Encrypt = false

	if err := cfg.IsValid(); err != nil {
		return err
	}

	utils.SaveConfig(utils.CfgFileName, cfg)

	return nil
}

func RemoveSamlPrivateCertificate() *model.AppError {
	if err := RemoveSamlFile(*utils.Cfg.SamlSettings.PrivateKeyFile); err != nil {
		return err
	}

	cfg := &model.Config{}
	*cfg = *utils.Cfg

	*cfg.SamlSettings.PrivateKeyFile = ""
	*cfg.SamlSettings.Encrypt = false

	if err := cfg.IsValid(); err != nil {
		return err
	}

	utils.SaveConfig(utils.CfgFileName, cfg)

	return nil
}

func RemoveSamlIdpCertificate() *model.AppError {
	if err := RemoveSamlFile(*utils.Cfg.SamlSettings.IdpCertificateFile); err != nil {
		return err
	}

	cfg := &model.Config{}
	*cfg = *utils.Cfg

	*cfg.SamlSettings.IdpCertificateFile = ""
	*cfg.SamlSettings.Enable = false

	if err := cfg.IsValid(); err != nil {
		return err
	}

	utils.SaveConfig(utils.CfgFileName, cfg)

	return nil
}

func GetSamlCertificateStatus() *model.SamlCertificateStatus {
	status := &model.SamlCertificateStatus{}

	status.IdpCertificateFile = utils.FileExistsInConfigFolder(*utils.Cfg.SamlSettings.IdpCertificateFile)
	status.PrivateKeyFile = utils.FileExistsInConfigFolder(*utils.Cfg.SamlSettings.PrivateKeyFile)
	status.PublicCertificateFile = utils.FileExistsInConfigFolder(*utils.Cfg.SamlSettings.PublicCertificateFile)

	return status
}
