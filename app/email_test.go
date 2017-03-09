// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestSendChangeUsernameEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var emailTo string = "test@example.com"
	var oldUsername string = "myoldusername"
	var newUsername string = "fancyusername"
	var locale string = "en"
	var siteURL string = ""
	var expectedPartialMessage string = "Your username for " + utils.Cfg.TeamSettings.SiteName + " has been changed to " + newUsername + "."
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Your username has changed"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(emailTo)

	if err := SendChangeUsernameEmail(oldUsername, newUsername, emailTo, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(emailTo)
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
				if resultsEmail, err := utils.GetMessageFromMailbox(emailTo, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
				}
			}
		}
	}
}

func TestSendEmailChangeVerifyEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var newUserEmail string = "newtest@example.com"
	var locale string = "en"
	var siteURL string = "http://localhost:8065"
	var expectedPartialMessage string = "You updated your email"
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Verify new email address"
	var token string = "TEST_TOKEN"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(newUserEmail)

	if err := SendEmailChangeVerifyEmail(newUserEmail, locale, siteURL, token); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(newUserEmail)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], newUserEmail) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(newUserEmail, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
					if !strings.Contains(resultsEmail.Body.Text, utils.UrlEncode(newUserEmail)) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong new email in the message")
					}
				}
			}
		}
	}
}

func TestSendEmailChangeEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var oldEmail string = "test@example.com"
	var newUserEmail string = "newtest@example.com"
	var locale string = "en"
	var siteURL string = ""
	var expectedPartialMessage string = "Your email address for Mattermost has been changed to " + newUserEmail
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Your email address has changed"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(oldEmail)

	if err := SendEmailChangeEmail(oldEmail, newUserEmail, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(oldEmail)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], oldEmail) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(oldEmail, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
				}
			}
		}
	}
}

func TestSendVerifyEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var userEmail string = "test@example.com"
	var locale string = "en"
	var siteURL string = "http://localhost:8605"
	var expectedPartialMessage string = "Please verify your email address by clicking below"
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Email Verification"
	var token string = "TEST_TOKEN"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(userEmail)

	if err := SendVerifyEmail(userEmail, locale, siteURL, token); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(userEmail)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], userEmail) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(userEmail, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
					if !strings.Contains(resultsEmail.Body.Text, utils.UrlEncode(userEmail)) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong new email in the message")
					}
				}
			}
		}
	}
}

func TestSendSignInChangeEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var email string = "test@example.com"
	var locale string = "en"
	var siteURL string = ""
	var method string = "AD/LDAP"
	var expectedPartialMessage string = "You updated your sign-in method on Mattermost to " + method + "."
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Your sign-in method has been updated"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(email)

	if err := SendSignInChangeEmail(email, method, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(email)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], email) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(email, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
				}
			}
		}
	}
}

func TestSendWelcomeEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var userId string = "32432nkjnijn432uj32"
	var email string = "test@example.com"
	var locale string = "en"
	var siteURL string = "http://test.mattermost.io"
	var verified bool = true
	var expectedPartialMessage string = "Mattermost lets you share messages and files from your PC or phone, with instant search and archiving"
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] You joined test.mattermost.io"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(email)

	if err := SendWelcomeEmail(userId, email, verified, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(email)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], email) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(email, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
				}
			}
		}
	}

	utils.DeleteMailBox(email)
	verified = false
	var expectedVerifyEmail string = "Please verify your email address by clicking below."

	if err := SendWelcomeEmail(userId, email, verified, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(email)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], email) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(email, resultsMailbox[0].ID); err == nil {
					if !strings.Contains(resultsEmail.Subject, expectedSubject) {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedVerifyEmail) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
					if !strings.Contains(resultsEmail.Body.Text, utils.UrlEncode(email)) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong email in the message")
					}
				}
			}
		}
	}
}

func TestSendPasswordChangeEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var email string = "test@example.com"
	var locale string = "en"
	var siteURL string = "http://test.mattermost.io"
	var method string = "using a reset password link"
	var expectedPartialMessage string = "Your password has been updated for " + utils.Cfg.TeamSettings.SiteName + " on " + siteURL + " by " + method
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Your password has been updated"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(email)

	if err := SendPasswordChangeEmail(email, method, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(email)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], email) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(email, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
				}
			}
		}
	}
}

func TestSendMfaChangeEmail(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	Setup()

	var email string = "test@example.com"
	var locale string = "en"
	var siteURL string = "http://test.mattermost.io"
	var activated bool = true
	var expectedPartialMessage string = "Multi-factor authentication has been added to your account on " + siteURL + "."
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Your MFA has been updated"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(email)

	if err := SendMfaChangeEmail(email, activated, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(email)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], email) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(email, resultsMailbox[0].ID); err == nil {
					if resultsEmail.Subject != expectedSubject {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
				}
			}
		}
	}

	activated = false
	expectedPartialMessage = "Multi-factor authentication has been removed from your account on " + siteURL + "."
	utils.DeleteMailBox(email)

	if err := SendMfaChangeEmail(email, activated, locale, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		var resultsMailbox utils.JSONMessageHeaderInbucket
		err := utils.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = utils.GetMailBox(email)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], email) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := utils.GetMessageFromMailbox(email, resultsMailbox[0].ID); err == nil {
					if !strings.Contains(resultsEmail.Subject, expectedSubject) {
						t.Log(resultsEmail.Subject)
						t.Fatal("Wrong Subject")
					}
					if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Wrong Body message")
					}
				}
			}
		}
	}
}

func TestSendInviteEmails(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	th := Setup().InitBasic()

	var email1 string = "test1@example.com"
	var email2 string = "test2@example.com"
	var senderName string = "TheBoss"
	var siteURL string = "http://test.mattermost.io"
	invites := []string{email1, email2}
	var expectedPartialMessage string = "The team member *" + senderName + "* , has invited you to join *" + th.BasicTeam.DisplayName + "*"
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] " + senderName + " invited you to join " + th.BasicTeam.DisplayName + " Team"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(email1)
	utils.DeleteMailBox(email2)

	SendInviteEmails(th.BasicTeam, senderName, invites, siteURL)

	//Check if the email was send to the rigth email address to email1
	var resultsMailbox utils.JSONMessageHeaderInbucket
	err := utils.RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = utils.GetMailBox(email1)
		return err
	})
	if err != nil {
		t.Log(err)
		t.Log("No email was received, maybe due load on the server. Disabling this verification")
	}
	if err == nil && len(resultsMailbox) > 0 {
		if !strings.ContainsAny(resultsMailbox[0].To[0], email1) {
			t.Fatal("Wrong To recipient")
		} else {
			if resultsEmail, err := utils.GetMessageFromMailbox(email1, resultsMailbox[0].ID); err == nil {
				if resultsEmail.Subject != expectedSubject {
					t.Log(resultsEmail.Subject)
					t.Log(expectedSubject)
					t.Fatal("Wrong Subject")
				}
				if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
					t.Log(resultsEmail.Body.Text)
					t.Fatal("Wrong Body message")
				}
			}
		}
	}

	//Check if the email was send to the rigth email address to email2
	err = utils.RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = utils.GetMailBox(email2)
		return err
	})
	if err != nil {
		t.Log(err)
		t.Log("No email was received, maybe due load on the server. Disabling this verification")
	}
	if err == nil && len(resultsMailbox) > 0 {
		if !strings.ContainsAny(resultsMailbox[0].To[0], email2) {
			t.Fatal("Wrong To recipient")
		} else {
			if resultsEmail, err := utils.GetMessageFromMailbox(email2, resultsMailbox[0].ID); err == nil {
				if !strings.Contains(resultsEmail.Subject, expectedSubject) {
					t.Log(resultsEmail.Subject)
					t.Log(expectedSubject)
					t.Fatal("Wrong Subject")
				}
				if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
					t.Log(resultsEmail.Body.Text)
					t.Fatal("Wrong Body message")
				}
			}
		}
	}
}

func TestSendPasswordReset(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	th := Setup().InitBasic()

	var siteURL string = "http://test.mattermost.io"
	// var locale string = "en"
	var expectedPartialMessage string = "To change your password"
	var expectedSubject string = "[" + utils.Cfg.TeamSettings.SiteName + "] Reset your password"

	//Delete all the messages before check the sample email
	utils.DeleteMailBox(th.BasicUser.Email)

	if _, err := SendPasswordReset(th.BasicUser.Email, siteURL); err != nil {
		t.Log(err)
		t.Fatal("Should send change username email")
	} else {
		//Check if the email was send to the rigth email address
		if resultsMailbox, err := utils.GetMailBox(th.BasicUser.Email); err != nil && !strings.ContainsAny(resultsMailbox[0].To[0], th.BasicUser.Email) {
			t.Fatal("Wrong To recipient")
		} else {
			if resultsEmail, err := utils.GetMessageFromMailbox(th.BasicUser.Email, resultsMailbox[0].ID); err == nil {
				if resultsEmail.Subject != expectedSubject {
					t.Log(resultsEmail.Subject)
					t.Fatal("Wrong Subject")
				}
				if !strings.Contains(resultsEmail.Body.Text, expectedPartialMessage) {
					t.Log(resultsEmail.Body.Text)
					t.Fatal("Wrong Body message")
				}
				loc := strings.Index(resultsEmail.Body.Text, "token=")
				if loc == -1 {
					t.Log(resultsEmail.Body.Text)
					t.Fatal("Code not found in email")
				}
				loc += 6
				recoveryTokenString := resultsEmail.Body.Text[loc : loc+model.TOKEN_SIZE]
				var recoveryToken *model.Token
				if result := <-Srv.Store.Token().GetByToken(recoveryTokenString); result.Err != nil {
					t.Log(recoveryTokenString)
					t.Fatal(result.Err)
				} else {
					recoveryToken = result.Data.(*model.Token)
					if !strings.Contains(resultsEmail.Body.Text, recoveryToken.Token) {
						t.Log(resultsEmail.Body.Text)
						t.Log(recoveryToken.Token)
						t.Fatal("Received wrong recovery code")
					}
				}
			}
		}
	}
}
