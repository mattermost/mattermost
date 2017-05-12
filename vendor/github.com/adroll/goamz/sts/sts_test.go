package sts_test

import (
	"testing"
	"time"

	"gopkg.in/check.v1"

	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/sts"
	"github.com/AdRoll/goamz/testutil"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})

type S struct {
	sts *sts.STS
}

var testServer = testutil.NewHTTPServer()

var mockTest bool

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.sts = sts.New(auth, aws.Region{STSEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestAssumeRole(c *check.C) {
	testServer.Response(200, nil, AssumeRoleResponse)
	request := &sts.AssumeRoleParams{
		DurationSeconds: 3600,
		ExternalId:      "123ABC",
		Policy:          `{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`,
		RoleArn:         "arn:aws:iam::123456789012:role/demo",
		RoleSessionName: "Bob",
	}
	resp, err := s.sts.AssumeRole(request)
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), check.Equals, "2011-06-15")
	c.Assert(values.Get("Action"), check.Equals, "AssumeRole")
	c.Assert(values.Get("DurationSeconds"), check.Equals, "3600")
	c.Assert(values.Get("ExternalId"), check.Equals, "123ABC")
	c.Assert(values.Get("Policy"), check.Equals, `{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`)
	c.Assert(values.Get("RoleArn"), check.Equals, "arn:aws:iam::123456789012:role/demo")
	c.Assert(values.Get("RoleSessionName"), check.Equals, "Bob")
	// Response test
	exp, _ := time.Parse(time.RFC3339, "2011-07-15T23:28:33.359Z")
	c.Assert(resp.RequestId, check.Equals, "c6104cbe-af31-11e0-8154-cbc7ccf896c7")
	c.Assert(resp.PackedPolicySize, check.Equals, 6)
	c.Assert(resp.AssumedRoleUser, check.DeepEquals, sts.AssumedRoleUser{
		Arn:           "arn:aws:sts::123456789012:assumed-role/demo/Bob",
		AssumedRoleId: "ARO123EXAMPLE123:Bob",
	})
	c.Assert(resp.Credentials, check.DeepEquals, sts.Credentials{
		SessionToken: `
       AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW
       LWsKWHGBuFqwAeMicRXmxfpSPfIeoIYRqTflfKD8YUuwthAx7mSEI/qkPpKPi/kMcGd
       QrmGdeehM4IC1NtBmUpp2wUE8phUZampKsburEDy0KPkyQDYwT7WZ0wq5VSXDvp75YU
       9HFvlRd8Tx6q6fE8YQcHNVXAkiY9q6d+xo0rKwT38xVqr7ZD0u0iPPkUL64lIZbqBAz
       +scqKmlzm8FDrypNC9Yjc8fPOLn9FX9KSYvKTr4rvx3iSIlTJabIQwj2ICCR/oLxBA==
      `,
		SecretAccessKey: `
       wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY
      `,
		AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
		Expiration:  exp,
	})

}

func (s *S) TestGetFederationToken(c *check.C) {
	testServer.Response(200, nil, GetFederationTokenResponse)
	resp, err := s.sts.GetFederationToken(
		"Bob",
		`{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`,
		3600,
	)
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), check.Equals, "2011-06-15")
	c.Assert(values.Get("Action"), check.Equals, "GetFederationToken")
	c.Assert(values.Get("DurationSeconds"), check.Equals, "3600")
	c.Assert(values.Get("Policy"), check.Equals, `{"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"*"}]}`)
	c.Assert(values.Get("Name"), check.Equals, "Bob")
	// Response test
	exp, _ := time.Parse(time.RFC3339, "2011-07-15T23:28:33.359Z")
	c.Assert(resp.RequestId, check.Equals, "c6104cbe-af31-11e0-8154-cbc7ccf896c7")
	c.Assert(resp.PackedPolicySize, check.Equals, 6)
	c.Assert(resp.FederatedUser, check.DeepEquals, sts.FederatedUser{
		Arn:             "arn:aws:sts::123456789012:federated-user/Bob",
		FederatedUserId: "123456789012:Bob",
	})
	c.Assert(resp.Credentials, check.DeepEquals, sts.Credentials{
		SessionToken: `
       AQoDYXdzEPT//////////wEXAMPLEtc764bNrC9SAPBSM22wDOk4x4HIZ8j4FZTwdQW
       LWsKWHGBuFqwAeMicRXmxfpSPfIeoIYRqTflfKD8YUuwthAx7mSEI/qkPpKPi/kMcGd
       QrmGdeehM4IC1NtBmUpp2wUE8phUZampKsburEDy0KPkyQDYwT7WZ0wq5VSXDvp75YU
       9HFvlRd8Tx6q6fE8YQcHNVXAkiY9q6d+xo0rKwT38xVqr7ZD0u0iPPkUL64lIZbqBAz
       +scqKmlzm8FDrypNC9Yjc8fPOLn9FX9KSYvKTr4rvx3iSIlTJabIQwj2ICCR/oLxBA==
      `,
		SecretAccessKey: `
       wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY
      `,
		AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
		Expiration:  exp,
	})

}

func (s *S) TestGetSessionToken(c *check.C) {
	testServer.Response(200, nil, GetSessionTokenResponse)
	resp, err := s.sts.GetSessionToken(3600, "YourMFADeviceSerialNumber", "123456")
	c.Assert(err, check.IsNil)
	values := testServer.WaitRequest().PostForm
	// Post request test
	c.Assert(values.Get("Version"), check.Equals, "2011-06-15")
	c.Assert(values.Get("Action"), check.Equals, "GetSessionToken")
	c.Assert(values.Get("DurationSeconds"), check.Equals, "3600")
	c.Assert(values.Get("SerialNumber"), check.Equals, "YourMFADeviceSerialNumber")
	c.Assert(values.Get("TokenCode"), check.Equals, "123456")
	// Response test
	exp, _ := time.Parse(time.RFC3339, "2011-07-11T19:55:29.611Z")
	c.Assert(resp.RequestId, check.Equals, "58c5dbae-abef-11e0-8cfe-09039844ac7d")
	c.Assert(resp.Credentials, check.DeepEquals, sts.Credentials{
		SessionToken: `
       AQoEXAMPLEH4aoAH0gNCAPyJxz4BlCFFxWNE1OPTgk5TthT+FvwqnKwRcOIfrRh3c/L
       To6UDdyJwOOvEVPvLXCrrrUtdnniCEXAMPLE/IvU1dYUg2RVAJBanLiHb4IgRmpRV3z
       rkuWJOgQs8IZZaIv2BXIa2R4OlgkBN9bkUDNCJiBeb/AXlzBBko7b15fjrBs2+cTQtp
       Z3CYWFXG8C5zqx37wnOE49mRl/+OtkIKGO7fAE
      `,
		SecretAccessKey: `
       wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY
      `,
		AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
		Expiration:  exp,
	})

}
