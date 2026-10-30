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
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	SamlPublicCertificateName = "saml-public.crt"
	SamlPrivateKeyName        = "saml-private.key"
	SamlIdpCertificateName    = "saml-idp.crt"
)

func (a *App) GetSamlMetadata(rctx request.CTX) (string, *model.AppError) {
	if a.Saml() == nil {
		err := model.NewAppError("GetSamlMetadata", "api.admin.saml.not_available.app_error", nil, "", http.StatusNotImplemented)
		return "", err
	}

	result, err := a.Saml().GetMetadata(rctx)
	if err != nil {
		return "", model.NewAppError("GetSamlMetadata", "api.admin.saml.metadata.app_error", nil, "", err.StatusCode).Wrap(err)
	}
	return result, nil
}

func readSamlFile(fileData *multipart.FileHeader) ([]byte, *model.AppError) {
	file, err := fileData.Open()
	if err != nil {
		return nil, model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.open.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return data, nil
}

func (ch *Channels) configureSaml(rctx request.CTX) {
	if ch.Saml == nil {
		return
	}

	if err := ch.Saml.ConfigureSP(rctx); err != nil {
		rctx.Logger().Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
	}
}

// Rotated certificates keep their filename, so no config listener fires; force the reload on every node.
func (a *App) reloadSaml(rctx request.CTX) {
	if a.Saml() == nil {
		return
	}

	a.ch.configureSaml(rctx)

	if a.Cluster() != nil {
		a.Cluster().SendClusterMessage(&model.ClusterMessage{
			Event:    model.ClusterEventReloadSaml,
			SendType: model.ClusterSendReliable,
		})
	}
}

func (a *App) saveSamlSettings(update func(*model.SamlSettings)) *model.AppError {
	cfg := a.Config().Clone()
	update(&cfg.SamlSettings)

	if err := cfg.IsValid(); err != nil {
		return err
	}

	_, _, err := a.SaveConfig(cfg, true)
	return err
}

// The certificate is already written, so reload even if saving the config fails.
func (a *App) saveSamlCertificateConfig(rctx request.CTX, filename string, field func(*model.SamlSettings) *string) *model.AppError {
	appErr := a.saveSamlSettings(func(s *model.SamlSettings) { *field(s) = filename })

	a.reloadSaml(rctx)

	return appErr
}

func (a *App) addSamlCertificate(rctx request.CTX, filename string, fileData *multipart.FileHeader, field func(*model.SamlSettings) *string) *model.AppError {
	data, appErr := readSamlFile(fileData)
	if appErr != nil {
		return appErr
	}

	if err := a.Srv().platform.SetConfigFile(filename, data); err != nil {
		return model.NewAppError("AddSamlCertificate", "api.admin.add_certificate.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.saveSamlCertificateConfig(rctx, filename, field)
}

func (a *App) AddSamlPublicCertificate(rctx request.CTX, fileData *multipart.FileHeader) *model.AppError {
	return a.addSamlCertificate(rctx, SamlPublicCertificateName, fileData, func(s *model.SamlSettings) *string { return s.PublicCertificateFile })
}

func (a *App) AddSamlPrivateCertificate(rctx request.CTX, fileData *multipart.FileHeader) *model.AppError {
	return a.addSamlCertificate(rctx, SamlPrivateKeyName, fileData, func(s *model.SamlSettings) *string { return s.PrivateKeyFile })
}

func (a *App) AddSamlIdpCertificate(rctx request.CTX, fileData *multipart.FileHeader) *model.AppError {
	data, appErr := readSamlFile(fileData)
	if appErr != nil {
		return appErr
	}

	der, err := parseSamlIdpCertificate(data)
	if err != nil {
		return model.NewAppError("AddSamlIdpCertificate", "api.admin.saml.invalid_idp_certificate_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return a.setSamlIdpCertificate(rctx, der)
}

// parseSamlIdpCertificate returns the DER bytes of a PEM-encoded X.509 certificate.
// Invalid data must be rejected, since the SP would otherwise keep trusting the previous certificate.
func parseSamlIdpCertificate(pemData []byte) ([]byte, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, errors.New("invalid PEM data")
	}
	if _, err := x509.ParseCertificate(block.Bytes); err != nil {
		return nil, err
	}

	return block.Bytes, nil
}

func (a *App) setSamlIdpCertificate(rctx request.CTX, der []byte) *model.AppError {
	data := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: der,
	})
	if err := a.Srv().platform.SetConfigFile(SamlIdpCertificateName, data); err != nil {
		return model.NewAppError("setSamlIdpCertificate", "api.admin.saml.failure_save_idp_certificate_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.saveSamlCertificateConfig(rctx, SamlIdpCertificateName, func(s *model.SamlSettings) *string { return s.IdpCertificateFile })
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

	return a.saveSamlSettings(func(s *model.SamlSettings) {
		*s.PublicCertificateFile = ""
		*s.Encrypt = false
	})
}

func (a *App) RemoveSamlPrivateCertificate() *model.AppError {
	if err := a.removeSamlFile(*a.Config().SamlSettings.PrivateKeyFile); err != nil {
		return err
	}

	return a.saveSamlSettings(func(s *model.SamlSettings) {
		*s.PrivateKeyFile = ""
		*s.Encrypt = false
	})
}

func (a *App) RemoveSamlIdpCertificate() *model.AppError {
	if err := a.removeSamlFile(*a.Config().SamlSettings.IdpCertificateFile); err != nil {
		return err
	}

	return a.saveSamlSettings(func(s *model.SamlSettings) {
		*s.IdpCertificateFile = ""
		*s.Enable = false
	})
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

	if len(entityDescriptor.IDPSSODescriptors) == 0 {
		err := model.NewAppError("BuildSamlMetadataObject", "api.admin.saml.invalid_xml_missing_idpssodescriptors.app_error", nil, "", http.StatusInternalServerError)
		return nil, err
	}

	idpSSODescriptor := entityDescriptor.IDPSSODescriptors[0]
	if len(idpSSODescriptor.SingleSignOnServices) == 0 {
		err := model.NewAppError("BuildSamlMetadataObject", "api.admin.saml.invalid_xml_missing_ssoservices.app_error", nil, "", http.StatusInternalServerError)
		return nil, err
	}

	data.IdpURL = idpSSODescriptor.SingleSignOnServices[0].Location
	if len(idpSSODescriptor.SSODescriptor.RoleDescriptor.KeyDescriptors) == 0 {
		err := model.NewAppError("BuildSamlMetadataObject", "api.admin.saml.invalid_xml_missing_keydescriptor.app_error", nil, "", http.StatusInternalServerError)
		return nil, err
	}
	keyDescriptor := idpSSODescriptor.SSODescriptor.RoleDescriptor.KeyDescriptors[0]
	data.IdpPublicCertificate = keyDescriptor.KeyInfo.X509Data.X509Certificate.Cert

	return data, nil
}

func (a *App) SetSamlIdpCertificateFromMetadata(rctx request.CTX, data []byte) *model.AppError {
	const certPrefix = "-----BEGIN CERTIFICATE-----\n"
	const certSuffix = "\n-----END CERTIFICATE-----"

	der, err := parseSamlIdpCertificate([]byte(certPrefix + string(data) + certSuffix))
	if err != nil {
		return model.NewAppError("SetSamlIdpCertificateFromMetadata", "api.admin.saml.failure_parse_idp_certificate.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return a.setSamlIdpCertificate(rctx, der)
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

func (a *App) CreateSamlRelayToken(tokenType string, extra string) (*model.Token, *model.AppError) {
	token := model.NewToken(tokenType, extra)

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
