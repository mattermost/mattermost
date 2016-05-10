// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mfa

import (
	b32 "encoding/base32"
	"fmt"
	"github.com/dgryski/dgoogauth"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/rsc/qr"
	"strings"
)

const (
	MFA_SECRET_SIZE = 30
)

type MfaInterfaceImpl struct {
}

func init() {
	mfa := &MfaInterfaceImpl{}
	einterfaces.RegisterMfaInterface(mfa)
}

func checkConfigAndLicense() *model.AppError {
	if !utils.IsLicensed || !*utils.License.Features.MFA || !*utils.Cfg.ServiceSettings.EnableMultifactorAuthentication {
		return model.NewLocAppError("checkConfigAndLicense", "ent.mfa.license_disable.app_error", nil, "")
	}

	return nil
}

func (m *MfaInterfaceImpl) GenerateQrCode(user *model.User) ([]byte, *model.AppError) {
	if err := checkConfigAndLicense(); err != nil {
		return nil, err
	}

	secret := b32.StdEncoding.EncodeToString([]byte(model.NewRandomString(MFA_SECRET_SIZE)))

	authLink := fmt.Sprintf("otpauth://totp/%s?secret=%s&issuer=Mattermost", user.Email, secret)

	code, err := qr.Encode(authLink, qr.H)

	if err != nil {
		return nil, model.NewLocAppError("GenerateQrCode", "ent.mfa.generate_qr_code.create_code.app_error", nil, err.Error())
	}

	img := code.PNG()

	if result := <-api.Srv.Store.User().UpdateMfaSecret(user.Id, secret); result.Err != nil {
		return nil, model.NewLocAppError("GenerateQrCode", "ent.mfa.generate_qr_code.save_secret.app_error", nil, result.Err.Error())
	}

	return img, nil
}

func (m *MfaInterfaceImpl) Activate(user *model.User, token string) *model.AppError {
	if err := checkConfigAndLicense(); err != nil {
		return err
	}

	otpConfig := &dgoogauth.OTPConfig{
		Secret:      user.MfaSecret,
		WindowSize:  3,
		HotpCounter: 0,
	}

	trimmedToken := strings.TrimSpace(token)

	ok, err := otpConfig.Authenticate(trimmedToken)
	if err != nil {
		return model.NewLocAppError("Activate", "ent.mfa.activate.authenticate.app_error", nil, err.Error())
	}

	if !ok {
		return model.NewLocAppError("Activate", "ent.mfa.activate.bad_token.app_error", nil, "")
	}

	if result := <-api.Srv.Store.User().UpdateMfaActive(user.Id, true); result.Err != nil {
		return model.NewLocAppError("Activate", "ent.mfa.activate.save_active.app_error", nil, result.Err.Error())
	}

	return nil
}

func (m *MfaInterfaceImpl) Deactivate(userId string) *model.AppError {
	if err := checkConfigAndLicense(); err != nil {
		return err
	}

	achan := api.Srv.Store.User().UpdateMfaActive(userId, false)
	schan := api.Srv.Store.User().UpdateMfaSecret(userId, "")

	if result := <-achan; result.Err != nil {
		return model.NewLocAppError("Deactivate", "ent.mfa.deactivate.save_active.app_error", nil, result.Err.Error())
	}

	if result := <-schan; result.Err != nil {
		return model.NewLocAppError("Deactivate", "ent.mfa.deactivate.save_secret.app_error", nil, result.Err.Error())
	}

	return nil
}

func (m *MfaInterfaceImpl) ValidateToken(secret, token string) (bool, *model.AppError) {
	if err := checkConfigAndLicense(); err != nil {
		return false, err
	}

	otpConfig := &dgoogauth.OTPConfig{
		Secret:      secret,
		WindowSize:  3,
		HotpCounter: 0,
	}

	trimmedToken := strings.TrimSpace(token)
	ok, err := otpConfig.Authenticate(trimmedToken)
	if err != nil {
		return false, model.NewLocAppError("ValidateToken", "ent.mfa.validate_token.authenticate.app_error", nil, err.Error())
	}

	return ok, nil
}
