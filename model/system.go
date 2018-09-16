// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"math/big"
)

const (
	SYSTEM_DIAGNOSTIC_ID          = "DiagnosticId"
	SYSTEM_RAN_UNIT_TESTS         = "RanUnitTests"
	SYSTEM_LAST_SECURITY_TIME     = "LastSecurityTime"
	SYSTEM_ACTIVE_LICENSE_ID      = "ActiveLicenseId"
	SYSTEM_LAST_COMPLIANCE_TIME   = "LastComplianceTime"
	SYSTEM_ASYMMETRIC_SIGNING_KEY = "AsymmetricSigningKey"
	SYSTEM_INSTALLATION_DATE_KEY  = "InstallationDate"
)

type System struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

func (o *System) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func SystemFromJson(data io.Reader) *System {
	var o *System
	json.NewDecoder(data).Decode(&o)
	return o
}

type SystemAsymmetricSigningKey struct {
	ECDSAKey *SystemECDSAKey `json:"ecdsa_key,omitempty"`
}

type SystemECDSAKey struct {
	Curve string   `json:"curve"`
	X     *big.Int `json:"x"`
	Y     *big.Int `json:"y"`
	D     *big.Int `json:"d,omitempty"`
}
