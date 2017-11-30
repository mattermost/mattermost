// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"

	"os"

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
		FileLocation:        NewString("foo"),
	}

	// should fail fast because batch size isn't set
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValidFileLocationInvalid(t *testing.T) {
	fs := &FileSettings{}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		BatchSize:           NewInt(100),
	}

	// should fail fast because FileLocation isn't set
	require.Error(t, mes.isValid(*fs))

	// if using the local file driver, there are more rules for FileLocation
	fs.DriverName = NewString(IMAGE_DRIVER_LOCAL)
	fs.Directory, _ = os.Getwd()
	mes.FileLocation = NewString("")

	// should fail fast because file location is not relative to basepath
	require.Error(t, mes.isValid(*fs))
}

func TestMessageExportSettingsIsValid(t *testing.T) {
	fs := &FileSettings{
		DriverName: NewString("foo"), // bypass file location check
	}
	mes := &MessageExportSettings{
		EnableExport:        NewBool(true),
		ExportFromTimestamp: NewInt64(0),
		DailyRunTime:        NewString("15:04"),
		FileLocation:        NewString("foo"),
		BatchSize:           NewInt(100),
	}

	// should pass because everything is valid
	require.Nil(t, mes.isValid(*fs))
}
