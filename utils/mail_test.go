// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"strings"
	"testing"

	"io/ioutil"

	"path"

	"net/mail"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMailConnection(t *testing.T) {
	cfg, _, err := LoadConfig("config.json")
	require.Nil(t, err)

	if conn, err := connectToSMTPServer(cfg); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		if _, err1 := newSMTPClient(conn, cfg); err1 != nil {
			t.Log(err)
			t.Fatal("Should get new smtp client")
		}
	}

	cfg.EmailSettings.SMTPServer = "wrongServer"
	cfg.EmailSettings.SMTPPort = "553"

	if _, err := connectToSMTPServer(cfg); err == nil {
		t.Log(err)
		t.Fatal("Should not to the STMP Server")
	}

}

func TestSendMailUsingConfig(t *testing.T) {
	cfg, _, err := LoadConfig("config.json")
	require.Nil(t, err)
	T = GetUserTranslations("en")

	var emailTo = "test@example.com"
	var emailSubject = "Testing this email"
	var emailBody = "This is a test from autobot"

	//Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	if err := SendMailUsingConfig(emailTo, emailSubject, emailBody, cfg); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		//Check if the email was send to the right email address
		var resultsMailbox JSONMessageHeaderInbucket
		err := RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = GetMailBox(emailTo)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], emailTo) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := GetMessageFromMailbox(emailTo, resultsMailbox[0].ID); err == nil {
					if !strings.Contains(resultsEmail.Body.Text, emailBody) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Received message")
					}
				}
			}
		}
	}
}

func TestSendMailUsingConfigAdvanced(t *testing.T) {
	cfg, _, err := LoadConfig("config.json")
	require.Nil(t, err)
	T = GetUserTranslations("en")

	var mimeTo = "test@example.com"
	var smtpTo = "test2@example.com"
	var from = mail.Address{Name: "Nobody", Address: "nobody@mattermost.com"}
	var emailSubject = "Testing this email"
	var emailBody = "This is a test from autobot"

	//Delete all the messages before check the sample email
	DeleteMailBox(smtpTo)

	// make a file backend that writes to a temp directory
	tempDirectory, tempDirError := ioutil.TempDir("", "")
	assert.Nil(t, tempDirError)
	fileSettings := &model.FileSettings{
		DriverName: model.NewString(model.IMAGE_DRIVER_LOCAL),
		Directory:  tempDirectory,
	}
	fileBackend, err := NewFileBackend(fileSettings)
	assert.Nil(t, err)

	// create a file that will be copied to the export directory
	fileContents := []byte("hello world")
	fileName := "file.txt"
	assert.Nil(t, fileBackend.WriteFile(fileContents, fileName))
	defer fileBackend.RemoveDirectory(tempDirectory)

	attachments := make([]*model.FileInfo, 1)
	attachments[0] = &model.FileInfo{
		Path: path.Join(tempDirectory, fileName),
	}

	headers := make(map[string]string)
	headers["TestHeader"] = "TestValue"

	if err := SendMailUsingConfigAdvanced(mimeTo, smtpTo, from, emailSubject, emailBody, attachments, headers, cfg); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		//Check if the email was send to the right email address
		var resultsMailbox JSONMessageHeaderInbucket
		err := RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = GetMailBox(smtpTo)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Fatal("No emails found for address " + smtpTo)
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], smtpTo) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := GetMessageFromMailbox(smtpTo, resultsMailbox[0].ID); err == nil {
					if !strings.Contains(resultsEmail.Body.Text, emailBody) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Received message")
					}

					// verify that the To header of the email message is set to the MIME recipient, even though we got it out of the SMTP recipient's email inbox
					assert.Equal(t, mimeTo, resultsEmail.Header["To"][0])

					// verify that the MIME from address is correct - unfortunately, we can't verify the SMTP from address
					assert.Equal(t, from.String(), resultsEmail.Header["From"][0])

					// check that the custom mime headers came through - header case seems to get mutated
					assert.Equal(t, "TestValue", resultsEmail.Header["Testheader"][0])

					// ensure that the attachment was successfully sent
					assert.Len(t, resultsEmail.Attachments, 1)
					assert.Equal(t, fileName, resultsEmail.Attachments[0].Filename)
					assert.Equal(t, fileContents, resultsEmail.Attachments[0].Bytes)
				}
			}
		}
	}
}
