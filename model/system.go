// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"math/big"
)

const (
	SYSTEM_DIAGNOSTIC_ID                      = "DiagnosticId"
	SYSTEM_RAN_UNIT_TESTS                     = "RanUnitTests"
	SYSTEM_LAST_SECURITY_TIME                 = "LastSecurityTime"
	SYSTEM_ACTIVE_LICENSE_ID                  = "ActiveLicenseId"
	SYSTEM_LAST_COMPLIANCE_TIME               = "LastComplianceTime"
	SYSTEM_ASYMMETRIC_SIGNING_KEY             = "AsymmetricSigningKey"
	SYSTEM_POST_ACTION_COOKIE_SECRET          = "PostActionCookieSecret"
	SYSTEM_INSTALLATION_DATE_KEY              = "InstallationDate"
	SYSTEM_FIRST_SERVER_RUN_TIMESTAMP_KEY     = "FirstServerRunTimestamp"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS = "warn_metric_number_of_active_users"
)

const NUMBER_OF_ACTIVE_USERS_WARN_METRIC_LIMIT = 1

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

type SystemPostActionCookieSecret struct {
	Secret []byte `json:"key,omitempty"`
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

// ServerBusyState provides serialization for app.Busy.
type ServerBusyState struct {
	Busy       bool   `json:"busy"`
	Expires    int64  `json:"expires"`
	Expires_ts string `json:"expires_ts,omitempty"`
}

func (sbs *ServerBusyState) ToJson() string {
	b, _ := json.Marshal(sbs)
	return string(b)
}

func ServerBusyStateFromJson(r io.Reader) *ServerBusyState {
	var sbs *ServerBusyState
	json.NewDecoder(r).Decode(&sbs)
	return sbs
}

type SendWarnMetricAck struct {
	ForceAck bool `json:"forceAck"`
}

func (swma *SendWarnMetricAck) ToJson() string {
	b, _ := json.Marshal(swma)
	return string(b)
}

func SendWarnMetricAckFromJson(r io.Reader) *SendWarnMetricAck {
	var swma *SendWarnMetricAck
	json.NewDecoder(r).Decode(&swma)
	return swma
}
