// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"strings"
	"testing"

	"net/mail"

	"fmt"

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

	if err := SendMailUsingConfig(emailTo, emailSubject, emailBody, cfg, true); err != nil {
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

	fileBackend, err := NewFileBackend(&cfg.FileSettings, true)
	assert.Nil(t, err)

	// create two files with the same name that will both be attached to the email
	fileName := "file.txt"
	filePath1 := fmt.Sprintf("test1/%s", fileName)
	filePath2 := fmt.Sprintf("test2/%s", fileName)
	fileContents1 := []byte("hello world")
	fileContents2 := []byte("foo bar")
	assert.Nil(t, fileBackend.WriteFile(fileContents1, filePath1))
	assert.Nil(t, fileBackend.WriteFile(fileContents2, filePath2))
	defer fileBackend.RemoveFile(filePath1)
	defer fileBackend.RemoveFile(filePath2)

	attachments := make([]*model.FileInfo, 2)
	attachments[0] = &model.FileInfo{
		Name: fileName,
		Path: filePath1,
	}
	attachments[1] = &model.FileInfo{
		Name: fileName,
		Path: filePath2,
	}

	headers := make(map[string]string)
	headers["TestHeader"] = "TestValue"

	if err := SendMailUsingConfigAdvanced(mimeTo, smtpTo, from, emailSubject, emailBody, attachments, headers, cfg, true); err != nil {
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

					// ensure that the attachments were successfully sent
					assert.Len(t, resultsEmail.Attachments, 2)
					assert.Equal(t, fileName, resultsEmail.Attachments[0].Filename)
					assert.Equal(t, fileName, resultsEmail.Attachments[1].Filename)
					attachment1 := string(resultsEmail.Attachments[0].Bytes)
					attachment2 := string(resultsEmail.Attachments[1].Bytes)
					if attachment1 == string(fileContents1) {
						assert.Equal(t, attachment2, string(fileContents2))
					} else if attachment1 == string(fileContents2) {
						assert.Equal(t, attachment2, string(fileContents1))
					} else {
						assert.Fail(t, "Unrecognized attachment contents")
					}
				}
			}
		}
	}
}
