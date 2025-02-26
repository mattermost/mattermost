// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	gomail "gopkg.in/mail.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

func TestDeliver(t *testing.T) {
	config := &model.Config{}
	config.SetDefaults()
	config.MessageExportSettings.GlobalRelaySettings.CustomerType = model.NewPointer("INBUCKET")
	config.MessageExportSettings.GlobalRelaySettings.EmailAddress = model.NewPointer("test-globalrelay-mailbox@test")

	t.Run("Testing invalid zip file", func(t *testing.T) {
		emptyFile, err := os.CreateTemp("", "export")
		require.NoError(t, err)
		defer emptyFile.Close()
		defer os.Remove(emptyFile.Name())

		err = Deliver(emptyFile, config)
		assert.Error(t, err)
	})

	t.Run("Testing empty zip file", func(t *testing.T) {
		emptyZipFile, err := os.CreateTemp("", "export")
		require.NoError(t, err)
		zipFile := zip.NewWriter(emptyZipFile)
		err = zipFile.Close()
		require.NoError(t, err)
		defer emptyZipFile.Close()
		defer os.Remove(emptyZipFile.Name())

		err = mail.DeleteMailBox(*config.MessageExportSettings.GlobalRelaySettings.EmailAddress)
		require.NoError(t, err)

		err = Deliver(emptyZipFile, config)
		assert.NoError(t, err)

		_, err = mail.GetMailBox(*config.MessageExportSettings.GlobalRelaySettings.EmailAddress)
		require.Error(t, err)
	})

	t.Run("Testing zip file with one email", func(t *testing.T) {
		headers := map[string][]string{
			"From":                       {"test@test.com"},
			"To":                         {*config.MessageExportSettings.GlobalRelaySettings.EmailAddress},
			"Subject":                    {encodeRFC2047Word("test")},
			"Content-Transfer-Encoding":  {"8bit"},
			"Auto-Submitted":             {"auto-generated"},
			"Precedence":                 {"bulk"},
			GlobalRelayMsgTypeHeader:     {"Mattermost"},
			GlobalRelayChannelNameHeader: {encodeRFC2047Word("test")},
			GlobalRelayChannelIDHeader:   {encodeRFC2047Word("test")},
			GlobalRelayChannelTypeHeader: {encodeRFC2047Word("test")},
		}

		m := gomail.NewMessage(gomail.SetCharset("UTF-8"))
		m.SetHeaders(headers)
		m.SetBody("text/plain", "test")

		emptyZipFile, err := os.CreateTemp("", "export")
		require.NoError(t, err)
		zipFile := zip.NewWriter(emptyZipFile)
		file, err := zipFile.Create("test")
		require.NoError(t, err)
		_, err = m.WriteTo(file)
		require.NoError(t, err)

		err = zipFile.Close()
		require.NoError(t, err)
		defer emptyZipFile.Close()
		defer os.Remove(emptyZipFile.Name())

		err = mail.DeleteMailBox(*config.MessageExportSettings.GlobalRelaySettings.EmailAddress)
		require.NoError(t, err)

		err = Deliver(emptyZipFile, config)
		assert.NoError(t, err)

		mailbox, err := mail.GetMailBox(*config.MessageExportSettings.GlobalRelaySettings.EmailAddress)
		require.NoError(t, err)
		require.Len(t, mailbox, 1)
	})

	t.Run("Testing zip file with 50 emails", func(t *testing.T) {
		headers := map[string][]string{
			"From":                       {"test@test.com"},
			"To":                         {*config.MessageExportSettings.GlobalRelaySettings.EmailAddress},
			"Subject":                    {encodeRFC2047Word("test")},
			"Content-Transfer-Encoding":  {"8bit"},
			"Auto-Submitted":             {"auto-generated"},
			"Precedence":                 {"bulk"},
			GlobalRelayMsgTypeHeader:     {"Mattermost"},
			GlobalRelayChannelNameHeader: {encodeRFC2047Word("test")},
			GlobalRelayChannelIDHeader:   {encodeRFC2047Word("test")},
			GlobalRelayChannelTypeHeader: {encodeRFC2047Word("test")},
		}
		m := gomail.NewMessage(gomail.SetCharset("UTF-8"))
		m.SetHeaders(headers)
		m.SetBody("text/plain", "test")

		emptyZipFile, err := os.CreateTemp("", "export")
		require.NoError(t, err)
		zipFile := zip.NewWriter(emptyZipFile)
		for x := 0; x < 50; x++ {
			var file io.Writer
			file, err = zipFile.Create(fmt.Sprintf("test-%d", x))
			require.NoError(t, err)
			_, err = m.WriteTo(file)
			require.NoError(t, err)
		}
		err = zipFile.Close()
		require.NoError(t, err)
		defer emptyZipFile.Close()
		defer os.Remove(emptyZipFile.Name())

		err = mail.DeleteMailBox(*config.MessageExportSettings.GlobalRelaySettings.EmailAddress)
		require.NoError(t, err)

		err = Deliver(emptyZipFile, config)
		assert.NoError(t, err)

		mailbox, err := mail.GetMailBox(*config.MessageExportSettings.GlobalRelaySettings.EmailAddress)
		require.NoError(t, err)
		require.Len(t, mailbox, 50)
	})
}
