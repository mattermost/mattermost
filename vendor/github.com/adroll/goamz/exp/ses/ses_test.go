package ses_test

import (
	"encoding/base64"
	"testing"

	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/exp/ses"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})
var testServer = testutil.NewHTTPServer()

type S struct {
	sesService *ses.SES
}

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	sesService := ses.New(auth, aws.Region{SESEndpoint: testServer.URL})
	s.sesService = sesService
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestSendEmailError(c *check.C) {
	testServer.Response(400, nil, TestSendEmailError)

	resp, err := s.sesService.SendEmail("foo@example.com",
		ses.NewDestination([]string{"unauthorized@example.com"}, []string{}, []string{}),
		ses.NewMessage("subject", "textBody", "htmlBody"))
	_ = testServer.WaitRequest()

	c.Assert(resp, check.IsNil)
	c.Assert(err.Error(), check.Equals, "Email address is not verified. (MessageRejected)")
}

func (s *S) TestSendEmail(c *check.C) {
	testServer.Response(200, nil, TestSendEmailOk)

	resp, err := s.sesService.SendEmail("foo@example.com",
		ses.NewDestination([]string{"to1@example.com", "to2@example.com"},
			[]string{"cc1@example.com", "cc2@example.com"},
			[]string{"bcc1@example.com", "bcc2@example.com"}),
		ses.NewMessage("subject", "textBody", "htmlBody"))
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.FormValue("Source"), check.Equals, "foo@example.com")
	c.Assert(req.FormValue("Destination.ToAddresses.member.1"), check.Equals, "to1@example.com")
	c.Assert(req.FormValue("Destination.ToAddresses.member.2"), check.Equals, "to2@example.com")
	c.Assert(req.FormValue("Destination.CcAddresses.member.1"), check.Equals, "cc1@example.com")
	c.Assert(req.FormValue("Destination.CcAddresses.member.2"), check.Equals, "cc2@example.com")
	c.Assert(req.FormValue("Destination.BccAddresses.member.1"), check.Equals, "bcc1@example.com")
	c.Assert(req.FormValue("Destination.BccAddresses.member.2"), check.Equals, "bcc2@example.com")

	c.Assert(req.FormValue("Message.Subject.Data"), check.Equals, "subject")
	c.Assert(req.FormValue("Message.Subject.Charset"), check.Equals, "utf-8")

	c.Assert(req.FormValue("Message.Body.Text.Data"), check.Equals, "textBody")
	c.Assert(req.FormValue("Message.Body.Text.Charset"), check.Equals, "utf-8")

	c.Assert(req.FormValue("Message.Body.Html.Data"), check.Equals, "htmlBody")
	c.Assert(req.FormValue("Message.Body.Html.Charset"), check.Equals, "utf-8")

	c.Assert(err, check.IsNil)
	c.Assert(resp.SendEmailResult, check.NotNil)
	c.Assert(resp.ResponseMetadata, check.NotNil)
}

func (s *S) TestSendRawEmailError(c *check.C) {
	testServer.Response(400, nil, TestSendEmailError)

	resp, err := s.sesService.SendRawEmail(nil, rawMessage)
	_ = testServer.WaitRequest()

	c.Assert(resp, check.IsNil)
	c.Assert(err.Error(), check.Equals, "Email address is not verified. (MessageRejected)")
}

func (s *S) TestSendRawEmailNoDestinations(c *check.C) {
	testServer.Response(200, nil, TestSendRawEmailOk)

	resp, err := s.sesService.SendRawEmail(nil, rawMessage)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.FormValue("Source"), check.Equals, "")

	c.Assert(req.FormValue("RawMessage.Data"), check.Equals,
		base64.StdEncoding.EncodeToString(rawMessage))

	c.Assert(err, check.IsNil)
	c.Assert(resp.SendRawEmailResult, check.NotNil)
	c.Assert(resp.ResponseMetadata, check.NotNil)
}

func (s *S) TestSendRawEmailWithDestinations(c *check.C) {
	testServer.Response(200, nil, TestSendRawEmailOk)

	resp, err := s.sesService.SendRawEmail([]string{
		"to1@example.com",
		"cc2@example.com",
		"bcc1@example.com",
		"other@example.com",
	}, rawMessage)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.FormValue("Source"), check.Equals, "")

	c.Assert(req.FormValue("Destinations.member.1"), check.Equals,
		"to1@example.com")
	c.Assert(req.FormValue("Destinations.member.2"), check.Equals,
		"cc2@example.com")
	c.Assert(req.FormValue("Destinations.member.3"), check.Equals,
		"bcc1@example.com")
	c.Assert(req.FormValue("Destinations.member.4"), check.Equals,
		"other@example.com")
	c.Assert(req.FormValue("RawMessage.Data"), check.Equals,
		base64.StdEncoding.EncodeToString(rawMessage))

	c.Assert(err, check.IsNil)
	c.Assert(resp.SendRawEmailResult, check.NotNil)
	c.Assert(resp.ResponseMetadata, check.NotNil)
}

var rawMessage = []byte(`To: "to1@example.com", "to2@example.com"
Cc: "cc1@example.com", "cc2@example.com"
Bcc: "bcc1@example.com", "bcc2@example.com"
From: foo@example.com
Subject: Test Subject
Content-Type: multipart/alternative; boundary=001a1147f9d0b5b8ce0525380c4b
MIME-Version: 1.0

--001a1147f9d0b5b8ce0525380c4b
Content-Type: text/plain; charset=UTF-8

Text Body

--001a1147f9d0b5b8ce0525380c4b
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

<h1>HTML</h1><p>body</p>

--001a1147f9d0b5b8ce0525380c4b--
`)
