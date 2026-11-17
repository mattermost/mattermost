// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type SamlDiagnosticInterface interface {
	// RunSupportPacketTest returns err if SAML sign-in would fail, and the certificates that apply
	// to settings, which are reported even then. A certificate that can't be read carries its own error.
	RunSupportPacketTest(rctx request.CTX, settings model.SamlSettings) (idpCert, spCert *model.SupportPacketCertificate, err error)
}
