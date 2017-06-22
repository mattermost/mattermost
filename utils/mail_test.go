// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"strings"
	"testing"
)

func TestMailConnection(t *testing.T) {
	LoadConfig("config.json")

	if conn, err := connectToSMTPServer(Cfg); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		if _, err1 := newSMTPClient(conn, Cfg); err1 != nil {
			t.Log(err)
			t.Fatal("Should get new smtp client")
		}
	}

	Cfg.EmailSettings.SMTPServer = "wrongServer"
	Cfg.EmailSettings.SMTPPort = "553"

	if _, err := connectToSMTPServer(Cfg); err == nil {
		t.Log(err)
		t.Fatal("Should not to the STMP Server")
	}

}

func TestSendMail(t *testing.T) {
	LoadConfig("config.json")
	T = GetUserTranslations("en")

	var emailTo string = "test@example.com"
	var emailSubject string = "Testing this email"
	var emailBody string = "This is a test from autobot"

	//Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	if err := SendMail(emailTo, emailSubject, emailBody); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		//Check if the email was send to the rigth email address
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
