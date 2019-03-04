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
	"github.com/mattermost/mattermost-server/utils/fileutils"
)

const (
	SamlPublicCertificateName = "saml-public.crt"
	SamlPrivateKeyName        = "saml-private.key"
	SamlIdpCertificateName    = "saml-idp.crt"
)

func (a *App) GetSamlMetadata() (string, *model.AppError) {
	if a.Saml == nil {
		err := model.NewAppError("GetSamlMetadata", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return "", err
	}

	result, err := a.Saml.GetMetadata()
	if err != nil {
		return "", model.NewAppError("GetSamlMetadata", "api.admin.saml.metadata.app_error", nil, "err="+err.Message, err.StatusCode)
	}
	return result, nil
}

func WriteSamlFile(filename string, fileData *multipart.FileHeader) *model.AppError {
	file, err := fileData.Open()
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.open.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer file.Close()

	configDir, _ := fileutils.FindDir("config")
	out, err := os.Create(filepath.Join(configDir, filename))
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer out.Close()

	io.Copy(out, file)
	return nil
}

func (a *App) AddSamlPublicCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(SamlPublicCertificateName, fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.PublicCertificateFile = SamlPublicCertificateName

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}

func (a *App) AddSamlPrivateCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(SamlPrivateKeyName, fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.PrivateKeyFile = SamlPrivateKeyName

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}

func (a *App) AddSamlIdpCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := WriteSamlFile(SamlIdpCertificateName, fileData); err != nil {
		return err
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.IdpCertificateFile = SamlIdpCertificateName

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}

func RemoveSamlFile(filename string) *model.AppError {
	if err := os.Remove(fileutils.FindConfigFile(filename)); err != nil {
		return model.NewAppError("removeCertificate", "api.admin.remove_certificate.delete.app_error", map[string]interface{}{"Filename": filename}, filename+": "+err.Error(), http.StatusInternalServerError)
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

	return nil
}

func (a *App) GetSamlCertificateStatus() *model.SamlCertificateStatus {
	status := &model.SamlCertificateStatus{}

	status.IdpCertificateFile = utils.FileExistsInConfigFolder(*a.Config().SamlSettings.IdpCertificateFile)
	status.PrivateKeyFile = utils.FileExistsInConfigFolder(*a.Config().SamlSettings.PrivateKeyFile)
	status.PublicCertificateFile = utils.FileExistsInConfigFolder(*a.Config().SamlSettings.PublicCertificateFile)

	return status
}
