// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
)

func SaveCertificate(certificate string, certType int) *model.AppError {
	saml := &model.SamlRecord{}
	saml.Bytes = certificate
	saml.Type = certType

	rchan := Srv.Store.Saml().Save(saml)
	if result := <-rchan; result.Err != nil {
		return model.NewLocAppError("SaveCertificate", "api.saml.save_certificate.app_error", nil, "err="+result.Err.Error())
	}

	return nil
}
