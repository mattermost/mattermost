// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"

	"path/filepath"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) GetSamlMetadata() (string, *model.AppError) {
	if a.Saml == nil {
		err := model.NewAppError("GetSamlMetadata", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return "", err
	}

	if result, err := a.Saml.GetMetadata(); err != nil {
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
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.open.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer file.Close()

	configDir, _ := utils.FindDir("config")
	out, err := os.Create(configDir + filename)
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer out.Close()

	io.Copy(out, file)
	return nil
}

func (a *App) AddSamlPublicCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.PublicCertificateFile = fileData.Filename

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })
	a.PersistConfig()

	return nil
}

func (a *App) AddSamlPrivateCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.PrivateKeyFile = fileData.Filename

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })
	a.PersistConfig()

	return nil
}

func (a *App) AddSamlIdpCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.IdpCertificateFile = fileData.Filename

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })
	a.PersistConfig()

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

func (a *App) RemoveSamlPublicCertificate() *model.AppError {
	if err := RemoveSamlFile(*a.Config().SamlSettings.PublicCertificateFile); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.PublicCertificateFile = ""
	*cfg.SamlSettings.Encrypt = false

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })
	a.PersistConfig()

	return nil
}

func (a *App) RemoveSamlPrivateCertificate() *model.AppError {
	if err := RemoveSamlFile(*a.Config().SamlSettings.PrivateKeyFile); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.PrivateKeyFile = ""
	*cfg.SamlSettings.Encrypt = false

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })
	a.PersistConfig()

	return nil
}

func (a *App) RemoveSamlIdpCertificate() *model.AppError {
	if err := RemoveSamlFile(*a.Config().SamlSettings.IdpCertificateFile); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.IdpCertificateFile = ""
	*cfg.SamlSettings.Enable = false

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })
	a.PersistConfig()

	return nil
}

func (a *App) GetSamlCertificateStatus() *model.SamlCertificateStatus {
	status := &model.SamlCertificateStatus{}

	status.IdpCertificateFile = utils.FileExistsInConfigFolder(*a.Config().SamlSettings.IdpCertificateFile)
	status.PrivateKeyFile = utils.FileExistsInConfigFolder(*a.Config().SamlSettings.PrivateKeyFile)
	status.PublicCertificateFile = utils.FileExistsInConfigFolder(*a.Config().SamlSettings.PublicCertificateFile)

	return status
}
