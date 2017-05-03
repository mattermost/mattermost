package s3_test

import (
	"encoding/xml"
	"github.com/AdRoll/goamz/s3"
	"gopkg.in/check.v1"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

func (s *S) TestLifecycleConfiguration(c *check.C) {
	date, err := time.Parse(s3.LifecycleRuleDateFormat, "2014-09-10")
	c.Check(err, check.IsNil)

	conf := &s3.LifecycleConfiguration{}

	rule := s3.NewLifecycleRule("transition-days", "/")
	rule.SetTransitionDays(7)
	conf.AddRule(rule)

	rule = s3.NewLifecycleRule("transition-date", "/")
	rule.SetTransitionDate(date)
	conf.AddRule(rule)

	rule = s3.NewLifecycleRule("expiration-days", "")
	rule.SetExpirationDays(1)
	conf.AddRule(rule)

	rule = s3.NewLifecycleRule("expiration-date", "")
	rule.SetExpirationDate(date)
	conf.AddRule(rule)

	rule = s3.NewLifecycleRule("noncurrent-transition", "")
	rule.SetNoncurrentVersionTransitionDays(11)
	conf.AddRule(rule)

	rule = s3.NewLifecycleRule("noncurrent-expiration", "")
	rule.SetNoncurrentVersionExpirationDays(1011)

	// Test Disable() and Enable() toggling
	c.Check(rule.Status, check.Equals, s3.LifecycleRuleStatusEnabled)
	rule.Disable()
	c.Check(rule.Status, check.Equals, s3.LifecycleRuleStatusDisabled)
	rule.Enable()
	c.Check(rule.Status, check.Equals, s3.LifecycleRuleStatusEnabled)
	rule.Disable()
	c.Check(rule.Status, check.Equals, s3.LifecycleRuleStatusDisabled)

	conf.AddRule(rule)

	doc, err := xml.MarshalIndent(conf, "", "  ")
	c.Check(err, check.IsNil)

	expectedDoc := `<LifecycleConfiguration>
  <Rule>
    <ID>transition-days</ID>
    <Prefix>/</Prefix>
    <Status>Enabled</Status>
    <Transition>
      <Days>7</Days>
      <StorageClass>GLACIER</StorageClass>
    </Transition>
  </Rule>
  <Rule>
    <ID>transition-date</ID>
    <Prefix>/</Prefix>
    <Status>Enabled</Status>
    <Transition>
      <Date>2014-09-10</Date>
      <StorageClass>GLACIER</StorageClass>
    </Transition>
  </Rule>
  <Rule>
    <ID>expiration-days</ID>
    <Prefix></Prefix>
    <Status>Enabled</Status>
    <Expiration>
      <Days>1</Days>
    </Expiration>
  </Rule>
  <Rule>
    <ID>expiration-date</ID>
    <Prefix></Prefix>
    <Status>Enabled</Status>
    <Expiration>
      <Date>2014-09-10</Date>
    </Expiration>
  </Rule>
  <Rule>
    <ID>noncurrent-transition</ID>
    <Prefix></Prefix>
    <Status>Enabled</Status>
    <NoncurrentVersionTransition>
      <NoncurrentDays>11</NoncurrentDays>
      <StorageClass>GLACIER</StorageClass>
    </NoncurrentVersionTransition>
  </Rule>
  <Rule>
    <ID>noncurrent-expiration</ID>
    <Prefix></Prefix>
    <Status>Disabled</Status>
    <NoncurrentVersionExpiration>
      <NoncurrentDays>1011</NoncurrentDays>
    </NoncurrentVersionExpiration>
  </Rule>
</LifecycleConfiguration>`

	c.Check(string(doc), check.Equals, expectedDoc)

	// Unmarshalling test
	conf2 := &s3.LifecycleConfiguration{}
	err = xml.Unmarshal(doc, conf2)
	c.Check(err, check.IsNil)
	s.checkLifecycleConfigurationEqual(c, conf, conf2)
}

func (s *S) checkLifecycleConfigurationEqual(c *check.C, conf, conf2 *s3.LifecycleConfiguration) {
	c.Check(len(*conf2.Rules), check.Equals, len(*conf.Rules))
	for i, rule := range *conf2.Rules {
		confRules := *conf.Rules
		c.Check(rule, check.DeepEquals, confRules[i])
	}
}

func (s *S) checkLifecycleRequest(c *check.C, req *http.Request) {
	// ?lifecycle= is the only query param
	v, ok := req.Form["lifecycle"]
	c.Assert(ok, check.Equals, true)
	c.Assert(v, check.HasLen, 1)
	c.Assert(v[0], check.Equals, "")

	c.Assert(req.Header["X-Amz-Date"], check.HasLen, 1)
	c.Assert(req.Header["X-Amz-Date"][0], check.Not(check.Equals), "")

	// Lifecycle methods require V4 auth
	usesV4 := strings.HasPrefix(req.Header["Authorization"][0], "AWS4-HMAC-SHA256")
	c.Assert(usesV4, check.Equals, true)
}

func (s *S) TestPutLifecycleConfiguration(c *check.C) {
	testServer.Response(200, nil, "")

	conf := &s3.LifecycleConfiguration{}
	rule := s3.NewLifecycleRule("id", "")
	rule.SetTransitionDays(7)
	conf.AddRule(rule)

	doc, err := xml.Marshal(conf)
	c.Check(err, check.IsNil)

	b := s.s3.Bucket("bucket")
	err = b.PutLifecycleConfiguration(conf)
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/")
	c.Assert(req.Header["Content-Md5"], check.HasLen, 1)
	c.Assert(req.Header["Content-Md5"][0], check.Not(check.Equals), "")
	s.checkLifecycleRequest(c, req)

	// Check we sent the correct xml serialization
	data, err := ioutil.ReadAll(req.Body)
	req.Body.Close()
	c.Assert(err, check.IsNil)
	header := "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
	c.Assert(string(data), check.Equals, header+string(doc))
}

func (s *S) TestGetLifecycleConfiguration(c *check.C) {
	conf := &s3.LifecycleConfiguration{}
	rule := s3.NewLifecycleRule("id", "")
	rule.SetTransitionDays(7)
	conf.AddRule(rule)

	doc, err := xml.Marshal(conf)
	c.Check(err, check.IsNil)

	testServer.Response(200, nil, string(doc))

	b := s.s3.Bucket("bucket")
	conf2, err := b.GetLifecycleConfiguration()
	c.Check(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/bucket/")
	s.checkLifecycleRequest(c, req)
	s.checkLifecycleConfigurationEqual(c, conf, conf2)
}

func (s *S) TestDeleteLifecycleConfiguration(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	err := b.DeleteLifecycleConfiguration()
	c.Check(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "DELETE")
	c.Assert(req.URL.Path, check.Equals, "/bucket/")
	s.checkLifecycleRequest(c, req)
}
