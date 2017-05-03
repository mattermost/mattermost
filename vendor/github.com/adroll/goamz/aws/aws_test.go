package aws_test

import (
	"github.com/AdRoll/goamz/aws"
	"gopkg.in/check.v1"
	"io/ioutil"
	"os"
	"strings"
	"testing"
	"time"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})

type S struct {
	environ []string
}

func (s *S) SetUpSuite(c *check.C) {
	s.environ = os.Environ()
}

func (s *S) TearDownTest(c *check.C) {
	os.Clearenv()
	for _, kv := range s.environ {
		l := strings.SplitN(kv, "=", 2)
		os.Setenv(l[0], l[1])
	}
}

func (s *S) TestEnvAuthNoSecret(c *check.C) {
	os.Clearenv()
	_, err := aws.EnvAuth()
	c.Assert(err, check.ErrorMatches, "AWS_SECRET_ACCESS_KEY or AWS_SECRET_KEY not found in environment")
}

func (s *S) TestEnvAuthNoAccess(c *check.C) {
	os.Clearenv()
	os.Setenv("AWS_SECRET_ACCESS_KEY", "foo")
	_, err := aws.EnvAuth()
	c.Assert(err, check.ErrorMatches, "AWS_ACCESS_KEY_ID or AWS_ACCESS_KEY not found in environment")
}

func (s *S) TestEnvAuth(c *check.C) {
	os.Clearenv()
	os.Setenv("AWS_SECRET_ACCESS_KEY", "secret")
	os.Setenv("AWS_ACCESS_KEY_ID", "access")
	auth, err := aws.EnvAuth()
	c.Assert(err, check.IsNil)
	c.Assert(auth, check.Equals, aws.Auth{SecretKey: "secret", AccessKey: "access"})
}

func (s *S) TestEnvAuthAlt(c *check.C) {
	os.Clearenv()
	os.Setenv("AWS_SECRET_KEY", "secret")
	os.Setenv("AWS_ACCESS_KEY", "access")
	auth, err := aws.EnvAuth()
	c.Assert(err, check.IsNil)
	c.Assert(auth, check.Equals, aws.Auth{SecretKey: "secret", AccessKey: "access"})
}

func (s *S) TestGetAuthStatic(c *check.C) {
	exptdate := time.Now().Add(time.Hour)
	auth, err := aws.GetAuth("access", "secret", "token", exptdate)
	c.Assert(err, check.IsNil)
	c.Assert(auth.AccessKey, check.Equals, "access")
	c.Assert(auth.SecretKey, check.Equals, "secret")
	c.Assert(auth.Token(), check.Equals, "token")
	c.Assert(auth.Expiration(), check.Equals, exptdate)
}

func (s *S) TestGetAuthEnv(c *check.C) {
	os.Clearenv()
	os.Setenv("AWS_SECRET_ACCESS_KEY", "secret")
	os.Setenv("AWS_ACCESS_KEY_ID", "access")
	auth, err := aws.GetAuth("", "", "", time.Time{})
	c.Assert(err, check.IsNil)
	c.Assert(auth, check.Equals, aws.Auth{SecretKey: "secret", AccessKey: "access"})
}

func (s *S) TestEncode(c *check.C) {
	c.Assert(aws.Encode("foo"), check.Equals, "foo")
	c.Assert(aws.Encode("/"), check.Equals, "%2F")
}

func (s *S) TestRegionsAreNamed(c *check.C) {
	for n, r := range aws.Regions {
		c.Assert(n, check.Equals, r.Name)
	}
}

func (s *S) TestCredentialsFileAuth(c *check.C) {
	file, err := ioutil.TempFile("", "creds")

	if err != nil {
		c.Fatal(err)
	}

	iniFile := `

[default] ; comment 123
aws_access_key_id = keyid1 ;comment
aws_secret_access_key=key1     

	[profile2]
    aws_access_key_id = keyid2 ;comment
	aws_secret_access_key=key2     
	aws_session_token=token1

`
	_, err = file.WriteString(iniFile)
	if err != nil {
		c.Fatal(err)
	}

	err = file.Close()
	if err != nil {
		c.Fatal(err)
	}

	// check non-existant profile
	_, err = aws.CredentialFileAuth(file.Name(), "no profile", 30*time.Minute)
	c.Assert(err, check.Not(check.Equals), nil)

	defaultProfile, err := aws.CredentialFileAuth(file.Name(), "default", 30*time.Minute)
	c.Assert(err, check.Equals, nil)
	c.Assert(defaultProfile.AccessKey, check.Equals, "keyid1")
	c.Assert(defaultProfile.SecretKey, check.Equals, "key1")
	c.Assert(defaultProfile.Token(), check.Equals, "")

	profile2, err := aws.CredentialFileAuth(file.Name(), "profile2", 30*time.Minute)
	c.Assert(err, check.Equals, nil)
	c.Assert(profile2.AccessKey, check.Equals, "keyid2")
	c.Assert(profile2.SecretKey, check.Equals, "key2")
	c.Assert(profile2.Token(), check.Equals, "token1")
}
