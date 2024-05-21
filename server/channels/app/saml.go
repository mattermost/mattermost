// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/x509"
	"encoding/pem"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	SamlPublicCertificateName = "saml-public.crt"
	SamlPrivateKeyName        = "saml-private.key"
	SamlIdpCertificateName    = "saml-idp.crt"
)

func (a *App) GetSamlMetadata(c request.CTX) (string, *model.AppError) {
	if a.Saml() == nil {
		err := model.NewAppError("GetSamlMetadata", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return "", err
	}

	result, err := a.Saml().GetMetadata(c)
	if err != nil {
		return "", model.NewAppError("GetSamlMetadata", "api.admin.saml.metadata.app_error", nil, "err="+err.Message, err.StatusCode)
	}
	return result, nil
}

func (a *App) writeSamlFile(filename string, fileData *multipart.FileHeader) *model.AppError {
	file, err := fileData.Open()
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.open.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	err = a.Srv().platform.SetConfigFile(filename, data)
	if err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) AddSamlPublicCertificate(fileData *multipart.FileHeader) *model.AppError {
	if err := a.writeSamlFile(SamlPublicCertificateName, fileData); err != nil {
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
	if err := a.writeSamlFile(SamlPrivateKeyName, fileData); err != nil {
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
	if err := a.writeSamlFile(SamlIdpCertificateName, fileData); err != nil {
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

func (a *App) removeSamlFile(filename string) *model.AppError {
	if err := a.Srv().platform.RemoveConfigFile(filename); err != nil {
		return model.NewAppError("RemoveSamlFile", "api.admin.remove_certificate.delete.app_error", map[string]any{"Filename": filename}, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) RemoveSamlPublicCertificate() *model.AppError {
	if err := a.removeSamlFile(*a.Config().SamlSettings.PublicCertificateFile); err != nil {
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
	if err := a.removeSamlFile(*a.Config().SamlSettings.PrivateKeyFile); err != nil {
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
	if err := a.removeSamlFile(*a.Config().SamlSettings.IdpCertificateFile); err != nil {
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

	status.IdpCertificateFile, _ = a.Srv().platform.HasConfigFile(*a.Config().SamlSettings.IdpCertificateFile)
	status.PrivateKeyFile, _ = a.Srv().platform.HasConfigFile(*a.Config().SamlSettings.PrivateKeyFile)
	status.PublicCertificateFile, _ = a.Srv().platform.HasConfigFile(*a.Config().SamlSettings.PublicCertificateFile)

	return status
}

func (a *App) GetSamlMetadataFromIdp(idpMetadataURL string) (*model.SamlMetadataResponse, *model.AppError) {
	if a.Saml() == nil {
		err := model.NewAppError("GetSamlMetadataFromIdp", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return nil, err
	}

	if !strings.HasPrefix(idpMetadataURL, "http://") && !strings.HasPrefix(idpMetadataURL, "https://") {
		idpMetadataURL = "https://" + idpMetadataURL
	}

	idpMetadataRaw, err := a.FetchSamlMetadataFromIdp(idpMetadataURL)
	if err != nil {
		return nil, err
	}

	data, err := a.BuildSamlMetadataObject(idpMetadataRaw)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (a *App) FetchSamlMetadataFromIdp(url string) ([]byte, *model.AppError) {
	resp, err := a.HTTPService().MakeClient(false).Get(url)
	if err != nil {
		return nil, model.NewAppError("FetchSamlMetadataFromIdp", "app.admin.saml.invalid_response_from_idp.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, model.NewAppError("FetchSamlMetadataFromIdp", "app.admin.saml.invalid_response_from_idp.app_error", nil, fmt.Sprintf("status_code=%d", resp.StatusCode), http.StatusBadRequest)
	}
	defer resp.Body.Close()

	bodyXML, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, model.NewAppError("FetchSamlMetadataFromIdp", "app.admin.saml.failure_read_response_body_from_idp.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bodyXML, nil
}

func (a *App) BuildSamlMetadataObject(idpMetadata []byte) (*model.SamlMetadataResponse, *model.AppError) {
	entityDescriptor := model.EntityDescriptor{}
	err := xml.Unmarshal(idpMetadata, &entityDescriptor)
	if err != nil {
		return nil, model.NewAppError("BuildSamlMetadataObject", "app.admin.saml.failure_decode_metadata_xml_from_idp.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	data := &model.SamlMetadataResponse{}
	data.IdpDescriptorURL = entityDescriptor.EntityID

	if entityDescriptor.IDPSSODescriptors == nil || len(entityDescriptor.IDPSSODescriptors) == 0 {
		err := model.NewAppError("BuildSamlMetadataObject", "api.admin.saml.invalid_xml_missing_idpssodescriptors.app_error", nil, "", http.StatusInternalServerError)
		return nil, err
	}

	idpSSODescriptor := entityDescriptor.IDPSSODescriptors[0]
	if idpSSODescriptor.SingleSignOnServices == nil || len(idpSSODescriptor.SingleSignOnServices) == 0 {
		err := model.NewAppError("BuildSamlMetadataObject", "api.admin.saml.invalid_xml_missing_ssoservices.app_error", nil, "", http.StatusInternalServerError)
		return nil, err
	}

	data.IdpURL = idpSSODescriptor.SingleSignOnServices[0].Location
	if idpSSODescriptor.SSODescriptor.RoleDescriptor.KeyDescriptors == nil || len(idpSSODescriptor.SSODescriptor.RoleDescriptor.KeyDescriptors) == 0 {
		err := model.NewAppError("BuildSamlMetadataObject", "api.admin.saml.invalid_xml_missing_keydescriptor.app_error", nil, "", http.StatusInternalServerError)
		return nil, err
	}
	keyDescriptor := idpSSODescriptor.SSODescriptor.RoleDescriptor.KeyDescriptors[0]
	data.IdpPublicCertificate = keyDescriptor.KeyInfo.X509Data.X509Certificate.Cert

	return data, nil
}

func (a *App) SetSamlIdpCertificateFromMetadata(data []byte) *model.AppError {
	const certPrefix = "-----BEGIN CERTIFICATE-----\n"
	const certSuffix = "\n-----END CERTIFICATE-----"
	fixedCertTxt := certPrefix + string(data) + certSuffix

	block, _ := pem.Decode([]byte(fixedCertTxt))
	if _, e := x509.ParseCertificate(block.Bytes); e != nil {
		return model.NewAppError("SetSamlIdpCertificateFromMetadata", "api.admin.saml.failure_parse_idp_certificate.app_error", nil, "", http.StatusInternalServerError).Wrap(e)
	}

	data = pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: block.Bytes,
	})

	if err := a.Srv().platform.SetConfigFile(SamlIdpCertificateName, data); err != nil {
		return model.NewAppError("SetSamlIdpCertificateFromMetadata", "api.admin.saml.failure_save_idp_certificate_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	cfg := a.Config().Clone()
	*cfg.SamlSettings.IdpCertificateFile = SamlIdpCertificateName

	if err := cfg.IsValid(); err != nil {
		return err
	}

	a.UpdateConfig(func(dest *model.Config) { *dest = *cfg })

	return nil
}

func (a *App) ResetSamlAuthDataToEmail(includeDeleted bool, dryRun bool, userIDs []string) (numAffected int, appErr *model.AppError) {
	if a.Saml() == nil {
		appErr = model.NewAppError("ResetAuthDataToEmail", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return
	}
	numAffected, err := a.Srv().Store().User().ResetAuthDataToEmailForUsers(model.UserAuthServiceSaml, userIDs, includeDeleted, dryRun)
	if err != nil {
		appErr = model.NewAppError("ResetAuthDataToEmail", "api.admin.saml.failure_reset_authdata_to_email.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	return
}

func (a *App) CreateSamlRelayToken(extra string) (*model.Token, *model.AppError) {
	token := model.NewToken(model.TokenTypeSaml, extra)

	if err := a.Srv().Store().Token().Save(token); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateSamlRelayToken", "app.recover.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return token, nil
}

func (a *App) GetSamlEmailToken(token string) (*model.Token, *model.AppError) {
	mToken, err := a.Srv().Store().Token().GetByToken(token)
	if err != nil {
		return nil, model.NewAppError("GetSamlEmailToken", "api.saml.invalid_email_token.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if mToken.Type != model.TokenTypeSaml {
		return nil, model.NewAppError("GetSamlEmailToken", "api.saml.invalid_email_token.app_error", nil, "", http.StatusBadRequest)
	}

	return mToken, nil
}
