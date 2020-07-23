// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"math/big"
)

const (
	SYSTEM_DIAGNOSTIC_ID                          = "DiagnosticId"
	SYSTEM_RAN_UNIT_TESTS                         = "RanUnitTests"
	SYSTEM_LAST_SECURITY_TIME                     = "LastSecurityTime"
	SYSTEM_ACTIVE_LICENSE_ID                      = "ActiveLicenseId"
	SYSTEM_LAST_COMPLIANCE_TIME                   = "LastComplianceTime"
	SYSTEM_ASYMMETRIC_SIGNING_KEY                 = "AsymmetricSigningKey"
	SYSTEM_POST_ACTION_COOKIE_SECRET              = "PostActionCookieSecret"
	SYSTEM_INSTALLATION_DATE_KEY                  = "InstallationDate"
	SYSTEM_FIRST_SERVER_RUN_TIMESTAMP_KEY         = "FirstServerRunTimestamp"
	SYSTEM_CLUSTER_ENCRYPTION_KEY                 = "ClusterEncryptionKey"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200 = "warn_metric_number_of_active_users_200"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_400 = "warn_metric_number_of_active_users_400"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500 = "warn_metric_number_of_active_users_500"
)

const (
	WARN_METRIC_STATUS_LIMIT_REACHED = "true"
	WARN_METRIC_STATUS_RUNONCE       = "runonce"
	WARN_METRIC_STATUS_ACK           = "ack"
	WARN_METRIC_STATUS_STORE_PREFIX  = "warn_metric_"
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

var WarnMetricsTable = map[string]WarnMetric{
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200,
		Limit:     200,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_400: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_400,
		Limit:     400,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500,
		Limit:     500,
		IsBotOnly: false,
		IsRunOnce: false,
	},
}

type WarnMetric struct {
	Id        string
	Limit     int64
	IsBotOnly bool
	IsRunOnce bool
}

type WarnMetricDisplayTexts struct {
	BotTitle       string
	BotMessageBody string
	BotMailToBody  string
	EmailBody      string
}
type WarnMetricStatus struct {
	Id          string `json:"id"`
	Limit       int64  `json:"limit"`
	Acked       bool   `json:"acked"`
	StoreStatus string `json:"store_status,omitempty"`
}

func (wms *WarnMetricStatus) ToJson() string {
	b, _ := json.Marshal(wms)
	return string(b)
}

func WarnMetricStatusFromJson(data io.Reader) *WarnMetricStatus {
	var o WarnMetricStatus
	if err := json.NewDecoder(data).Decode(&o); err != nil {
		return nil
	} else {
		return &o
	}
}

func MapWarnMetricStatusToJson(o map[string]*WarnMetricStatus) string {
	b, _ := json.Marshal(o)
	return string(b)
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
