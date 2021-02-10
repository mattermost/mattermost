// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"math/big"
)

const (
	SYSTEM_TELEMETRY_ID                           = "DiagnosticId"
	SYSTEM_RAN_UNIT_TESTS                         = "RanUnitTests"
	SYSTEM_LAST_SECURITY_TIME                     = "LastSecurityTime"
	SYSTEM_ACTIVE_LICENSE_ID                      = "ActiveLicenseId"
	SYSTEM_LICENSE_RENEWAL_TOKEN                  = "LicenseRenewalToken"
	SYSTEM_LAST_COMPLIANCE_TIME                   = "LastComplianceTime"
	SYSTEM_ASYMMETRIC_SIGNING_KEY                 = "AsymmetricSigningKey"
	SYSTEM_POST_ACTION_COOKIE_SECRET              = "PostActionCookieSecret"
	SYSTEM_INSTALLATION_DATE_KEY                  = "InstallationDate"
	SYSTEM_FIRST_SERVER_RUN_TIMESTAMP_KEY         = "FirstServerRunTimestamp"
	SYSTEM_CLUSTER_ENCRYPTION_KEY                 = "ClusterEncryptionKey"
	SYSTEM_UPGRADED_FROM_TE_ID                    = "UpgradedFromTE"
	SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5          = "warn_metric_number_of_teams_5"
	SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_50      = "warn_metric_number_of_channels_50"
	SYSTEM_WARN_METRIC_MFA                        = "warn_metric_mfa"
	SYSTEM_WARN_METRIC_EMAIL_DOMAIN               = "warn_metric_email_domain"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100 = "warn_metric_number_of_active_users_100"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200 = "warn_metric_number_of_active_users_200"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300 = "warn_metric_number_of_active_users_300"
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500 = "warn_metric_number_of_active_users_500"
	SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M         = "warn_metric_number_of_posts_2M"
	SYSTEM_WARN_METRIC_LAST_RUN_TIMESTAMP_KEY     = "LastWarnMetricRunTimestamp"
	AWS_METERING_REPORT_INTERVAL                  = 1
	AWS_METERING_DIMENSION_USAGE_HRS              = "UsageHrs"
	USER_LIMIT_OVERAGE_CYCLE_END_DATE             = "UserLimitOverageCycleEndDate"
	OVER_USER_LIMIT_FORGIVEN_COUNT                = "OverUserLimitForgivenCount"
	OVER_USER_LIMIT_LAST_EMAIL_SENT               = "OverUserLimitLastEmailSent"
)

const (
	WARN_METRIC_STATUS_LIMIT_REACHED      = "true"
	WARN_METRIC_STATUS_RUNONCE            = "runonce"
	WARN_METRIC_STATUS_ACK                = "ack"
	WARN_METRIC_STATUS_STORE_PREFIX       = "warn_metric_"
	WARN_METRIC_JOB_INTERVAL              = 24 * 7
	WARN_METRIC_NUMBER_OF_ACTIVE_USERS_25 = 25
	WARN_METRIC_JOB_WAIT_TIME             = 1000 * 3600 * 24 * 7 // 7 days
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

type SupportPacket struct {
	ServerOS             string   `yaml:"server_os"`
	ServerArchitecture   string   `yaml:"server_architecture"`
	DatabaseType         string   `yaml:"database_type"`
	DatabaseVersion      string   `yaml:"database_version"`
	LdapVendorName       string   `yaml:"ldap_vendor_name,omitempty"`
	LdapVendorVersion    string   `yaml:"ldap_vendor_version,omitempty"`
	ElasticServerVersion string   `yaml:"elastic_server_version,omitempty"`
	ElasticServerPlugins []string `yaml:"elastic_server_plugins,omitempty"`
}

type FileData struct {
	Filename string
	Body     []byte
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
	SYSTEM_WARN_METRIC_MFA: {
		Id:        SYSTEM_WARN_METRIC_MFA,
		Limit:     -1,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_EMAIL_DOMAIN: {
		Id:        SYSTEM_WARN_METRIC_EMAIL_DOMAIN,
		Limit:     -1,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5,
		Limit:     5,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_50: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_50,
		Limit:     50,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100,
		Limit:     100,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200,
		Limit:     200,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300,
		Limit:     300,
		IsBotOnly: true,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500,
		Limit:     500,
		IsBotOnly: false,
		IsRunOnce: true,
	},
	SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M: {
		Id:        SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M,
		Limit:     2000000,
		IsBotOnly: false,
		IsRunOnce: true,
	},
}

type WarnMetric struct {
	Id        string
	Limit     int64
	IsBotOnly bool
	IsRunOnce bool
}

type WarnMetricDisplayTexts struct {
	BotTitle          string
	BotMessageBody    string
	BotSuccessMessage string
	EmailBody         string
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
	}
	return &o
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
