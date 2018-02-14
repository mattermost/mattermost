// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConfigDefaultFileSettingsDirectory(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	if c1.FileSettings.Directory != "./data/" {
		t.Fatal("FileSettings.Directory should default to './data/'")
	}
}

func TestConfigDefaultEmailNotificationContentsType(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	if *c1.EmailSettings.EmailNotificationContentsType != EMAIL_NOTIFICATION_CONTENTS_FULL {
		t.Fatal("EmailSettings.EmailNotificationContentsType should default to 'full'")
	}
}

func TestConfigDefaultFileSettingsS3SSE(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	if *c1.FileSettings.AmazonS3SSE {
		t.Fatal("FileSettings.AmazonS3SSE should default to false")
	}
}

func TestConfigDefaultServiceSettingsExperimentalGroupUnreadChannels(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	if *c1.ServiceSettings.ExperimentalGroupUnreadChannels != GROUP_UNREAD_CHANNELS_DISABLED {
		t.Fatal("ServiceSettings.ExperimentalGroupUnreadChannels should default to 'disabled'")
	}

	// This setting was briefly a boolean, so ensure that those values still work as expected
	c1 = Config{
		ServiceSettings: ServiceSettings{
			ExperimentalGroupUnreadChannels: NewString("1"),
		},
	}
	c1.SetDefaults()

	if *c1.ServiceSettings.ExperimentalGroupUnreadChannels != GROUP_UNREAD_CHANNELS_DEFAULT_ON {
		t.Fatal("ServiceSettings.ExperimentalGroupUnreadChannels should set true to 'default on'")
	}

	c1 = Config{
		ServiceSettings: ServiceSettings{
			ExperimentalGroupUnreadChannels: NewString("0"),
		},
	}
	c1.SetDefaults()

	if *c1.ServiceSettings.ExperimentalGroupUnreadChannels != GROUP_UNREAD_CHANNELS_DISABLED {
		t.Fatal("ServiceSettings.ExperimentalGroupUnreadChannels should set false to 'disabled'")
	}
}

func TestMessageExportSettingsIsValidEnableExportNotSet(t *testing.T) {
	fs := &FileSettings{}
	mes := &MessageExportSettings{}

	// should fail fast because mes.EnableExport is not set
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidEnableExportFalse(t *testing.T) {
	fs := &FileSettings{}
	mes := &MessageExportSettings{
		EnableExport: NewBool(false),
	}

	// should fail fast because message export isn't enabled
	require.Nil(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidExportFromTimestampInvalid(t *testing.T) {
	fs := &FileSettings{}
	mes := &MessageExportSettings{
		EnableExport: NewBool(true),
	}

	// should fail fast because export from timestamp isn't set
	require.Error(t, mes.isValid(*fs))

	mes.ExportFromTimestamp = NewInt64(-1)

	// should fail fast because export from timestamp isn't valid
	require.Error(t, mes.isValid(*fs))

	mes.ExportFromTimestamp = NewInt64(GetMillis() + 10000)

	// should fail fast because export from timestamp is greater than current time
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidDailyRunTimeInvalid(t *testing.T) {
	fs := &FileSettings{}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFromTimestamp: NewInt64(0),
	}

	// should fail fast because daily runtime isn't set
	require.Error(t, mes.isValid(*fs))

	mes.DailyRunTime = NewString("33:33:33")

	// should fail fast because daily runtime is invalid format
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidBatchSizeInvalid(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
	}

	// should fail fast because batch size isn't set
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidExportFormatInvalid(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
	}

	// should fail fast because export format isn't set
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelayEmailAddressInvalid(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
	}

	// should fail fast because global relay email address isn't set
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidActiance(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_ACTIANCE),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
	}

	// should pass because everything is valid
	require.Nil(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsMissing(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
	}

	// should fail because globalrelay settings are missing
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsInvalidCustomerType(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewString("Invalid"),
			EmailAddress: NewString("valid@mattermost.com"),
			SmtpUsername: NewString("SomeUsername"),
			SmtpPassword: NewString("SomePassword"),
		},
	}

	// should fail because customer type is invalid
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsInvalidEmailAddress(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewString(GLOBALRELAY_CUSTOMER_TYPE_A9),
			EmailAddress: NewString("invalidEmailAddress"),
			SmtpUsername: NewString("SomeUsername"),
			SmtpPassword: NewString("SomePassword"),
		},
	}

	// should fail because email address is invalid
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsMissingSmtpUsername(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewString(GLOBALRELAY_CUSTOMER_TYPE_A10),
			EmailAddress: NewString("valid@mattermost.com"),
			SmtpPassword: NewString("SomePassword"),
		},
	}

	// should fail because smtp username is undefined
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsInvalidSmtpUsername(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewString(GLOBALRELAY_CUSTOMER_TYPE_A10),
			EmailAddress: NewString("valid@mattermost.com"),
			SmtpUsername: NewString(""),
			SmtpPassword: NewString("SomePassword"),
		},
	}

	// should fail because smtp username is invalid
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsMissingSmtpPassword(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewString(GLOBALRELAY_CUSTOMER_TYPE_A9),
			EmailAddress: NewString("valid@mattermost.com"),
			SmtpUsername: NewString("SomeUsername"),
		},
	}

	// should fail because smtp password is undefined
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsInvalidSmtpPassword(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewString(GLOBALRELAY_CUSTOMER_TYPE_A10),
			EmailAddress: NewString("valid@mattermost.com"),
			SmtpUsername: NewString("SomeUsername"),
			SmtpPassword: NewString(""),
		},
	}

	// should fail because smtp password is invalid
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidGlobalRelay(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFormat:        NewString(COMPLIANCE_EXPORT_TYPE_GLOBALRELAY),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewString(GLOBALRELAY_CUSTOMER_TYPE_A9),
			EmailAddress: NewString("valid@mattermost.com"),
			SmtpUsername: NewString("SomeUsername"),
			SmtpPassword: NewString("SomePassword"),
		},
	}

	// should pass
	require.Nil(t, mes.isValid(*fs))
}

func TestMessageExportSetDefaults(t *testing.T) {
	mes := &MessageExportSettings{}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
	require.Equal(t, COMPLIANCE_EXPORT_TYPE_ACTIANCE, *mes.ExportFormat)
}

func TestMessageExportSetDefaultsExportEnabledExportFromTimestampNil(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport: NewBool(true),
	}
	mes.SetDefaults()

	require.True(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.NotEqual(t, int64(0), *mes.ExportFromTimestamp)
	require.True(t, *mes.ExportFromTimestamp <= GetMillis())
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportEnabledExportFromTimestampZero(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFromTimestamp: NewInt64(0),
	}
	mes.SetDefaults()

	require.True(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.NotEqual(t, int64(0), *mes.ExportFromTimestamp)
	require.True(t, *mes.ExportFromTimestamp <= GetMillis())
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportEnabledExportFromTimestampNonZero(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFromTimestamp: NewInt64(12345),
	}
	mes.SetDefaults()

	require.True(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(12345), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportDisabledExportFromTimestampNil(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport: NewBool(false),
	}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportDisabledExportFromTimestampZero(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewBool(false),
		ExportFromTimestamp: NewInt64(0),
	}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportDisabledExportFromTimestampNonZero(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewBool(false),
		ExportFromTimestamp: NewInt64(12345),
	}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}
