package sdb_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/exp/sdb"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
	"testing"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

var _ = check.Suite(&S{})

type S struct {
	sdb *sdb.SDB
}

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.sdb = sdb.New(auth, aws.Region{SDBEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) TestCreateDomainOK(c *check.C) {
	testServer.Response(200, nil, TestCreateDomainXmlOK)

	domain := s.sdb.Domain("domain")
	resp, err := domain.CreateDomain()
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "63264005-7a5f-e01a-a224-395c63b89f6d")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0055590279)

	c.Assert(err, check.IsNil)
}

func (s *S) TestListDomainsOK(c *check.C) {
	testServer.Response(200, nil, TestListDomainsXmlOK)

	resp, err := s.sdb.ListDomains()
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "15fcaf55-9914-63c2-21f3-951e31193790")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0000071759)
	c.Assert(resp.Domains, check.DeepEquals, []string{"Account", "Domain", "Record"})

	c.Assert(err, check.IsNil)
}

func (s *S) TestListDomainsWithNextTokenXmlOK(c *check.C) {
	testServer.Response(200, nil, TestListDomainsWithNextTokenXmlOK)

	resp, err := s.sdb.ListDomains()
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "eb13162f-1b95-4511-8b12-489b86acfd28")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0000219907)
	c.Assert(resp.Domains, check.DeepEquals, []string{"Domain1-200706011651", "Domain2-200706011652"})
	c.Assert(resp.NextToken, check.Equals, "TWV0ZXJpbmdUZXN0RG9tYWluMS0yMDA3MDYwMTE2NTY=")

	c.Assert(err, check.IsNil)
}

func (s *S) TestDeleteDomainOK(c *check.C) {
	testServer.Response(200, nil, TestDeleteDomainXmlOK)

	domain := s.sdb.Domain("domain")
	resp, err := domain.DeleteDomain()
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "039e1e25-9a64-2a74-93da-2fda36122a97")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0055590278)

	c.Assert(err, check.IsNil)
}

func (s *S) TestPutAttrsOK(c *check.C) {
	testServer.Response(200, nil, TestPutAttrsXmlOK)

	domain := s.sdb.Domain("MyDomain")
	item := domain.Item("Item123")

	putAttrs := new(sdb.PutAttrs)
	putAttrs.Add("FirstName", "john")
	putAttrs.Add("LastName", "smith")
	putAttrs.Replace("MiddleName", "jacob")

	putAttrs.IfValue("FirstName", "john")
	putAttrs.IfMissing("FirstName")

	resp, err := item.PutAttrs(putAttrs)
	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"PutAttributes"})
	c.Assert(req.Form["ItemName"], check.DeepEquals, []string{"Item123"})
	c.Assert(req.Form["DomainName"], check.DeepEquals, []string{"MyDomain"})
	c.Assert(req.Form["Attribute.1.Name"], check.DeepEquals, []string{"FirstName"})
	c.Assert(req.Form["Attribute.1.Value"], check.DeepEquals, []string{"john"})
	c.Assert(req.Form["Attribute.2.Name"], check.DeepEquals, []string{"LastName"})
	c.Assert(req.Form["Attribute.2.Value"], check.DeepEquals, []string{"smith"})
	c.Assert(req.Form["Attribute.3.Name"], check.DeepEquals, []string{"MiddleName"})
	c.Assert(req.Form["Attribute.3.Value"], check.DeepEquals, []string{"jacob"})
	c.Assert(req.Form["Attribute.3.Replace"], check.DeepEquals, []string{"true"})

	c.Assert(req.Form["Expected.1.Name"], check.DeepEquals, []string{"FirstName"})
	c.Assert(req.Form["Expected.1.Value"], check.DeepEquals, []string{"john"})
	c.Assert(req.Form["Expected.1.Exists"], check.DeepEquals, []string{"false"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "490206ce-8292-456c-a00f-61b335eb202b")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0000219907)

}

func (s *S) TestDeleteAttrsOK(c *check.C) {
	testServer.Response(200, nil, TestDeleteAttrsXmlOK)

	domain := s.sdb.Domain("MyDomain")
	item := domain.Item("Item123")

	deleteAttrs := new(sdb.DeleteAttrs)
	deleteAttrs.Delete("FirstName", "john")
	deleteAttrs.Delete("LastName", "smith")

	deleteAttrs.IfValue("FirstName", "john")
	deleteAttrs.IfMissing("FirstName")

	resp, err := item.DeleteAttrs(deleteAttrs)
	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"DeleteAttributes"})
	c.Assert(req.Form["ItemName"], check.DeepEquals, []string{"Item123"})
	c.Assert(req.Form["DomainName"], check.DeepEquals, []string{"MyDomain"})
	c.Assert(req.Form["Attribute.1.Name"], check.DeepEquals, []string{"FirstName"})
	c.Assert(req.Form["Attribute.1.Value"], check.DeepEquals, []string{"john"})
	c.Assert(req.Form["Attribute.2.Name"], check.DeepEquals, []string{"LastName"})
	c.Assert(req.Form["Attribute.2.Value"], check.DeepEquals, []string{"smith"})

	c.Assert(req.Form["Expected.1.Name"], check.DeepEquals, []string{"FirstName"})
	c.Assert(req.Form["Expected.1.Value"], check.DeepEquals, []string{"john"})
	c.Assert(req.Form["Expected.1.Exists"], check.DeepEquals, []string{"false"})

	c.Assert(err, check.IsNil)
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "05ae667c-cfac-41a8-ab37-a9c897c4c3ca")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0000219907)

}

func (s *S) TestAttrsOK(c *check.C) {
	testServer.Response(200, nil, TestAttrsXmlOK)

	domain := s.sdb.Domain("MyDomain")
	item := domain.Item("Item123")

	resp, err := item.Attrs(nil, true)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"GetAttributes"})
	c.Assert(req.Form["ItemName"], check.DeepEquals, []string{"Item123"})
	c.Assert(req.Form["DomainName"], check.DeepEquals, []string{"MyDomain"})
	c.Assert(req.Form["ConsistentRead"], check.DeepEquals, []string{"true"})

	c.Assert(resp.Attrs[0].Name, check.Equals, "Color")
	c.Assert(resp.Attrs[0].Value, check.Equals, "Blue")
	c.Assert(resp.Attrs[1].Name, check.Equals, "Size")
	c.Assert(resp.Attrs[1].Value, check.Equals, "Med")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "b1e8f1f7-42e9-494c-ad09-2674e557526d")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0000219942)

	c.Assert(err, check.IsNil)
}

func (s *S) TestAttrsSelectOK(c *check.C) {
	testServer.Response(200, nil, TestAttrsXmlOK)

	domain := s.sdb.Domain("MyDomain")
	item := domain.Item("Item123")

	resp, err := item.Attrs([]string{"Color", "Size"}, true)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"GetAttributes"})
	c.Assert(req.Form["ItemName"], check.DeepEquals, []string{"Item123"})
	c.Assert(req.Form["DomainName"], check.DeepEquals, []string{"MyDomain"})
	c.Assert(req.Form["ConsistentRead"], check.DeepEquals, []string{"true"})
	c.Assert(req.Form["AttributeName.1"], check.DeepEquals, []string{"Color"})
	c.Assert(req.Form["AttributeName.2"], check.DeepEquals, []string{"Size"})

	c.Assert(resp.Attrs[0].Name, check.Equals, "Color")
	c.Assert(resp.Attrs[0].Value, check.Equals, "Blue")
	c.Assert(resp.Attrs[1].Name, check.Equals, "Size")
	c.Assert(resp.Attrs[1].Value, check.Equals, "Med")
	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "b1e8f1f7-42e9-494c-ad09-2674e557526d")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0000219942)

	c.Assert(err, check.IsNil)
}

func (s *S) TestSelectOK(c *check.C) {
	testServer.Response(200, nil, TestSelectXmlOK)

	resp, err := s.sdb.Select("select Color from MyDomain where Color like 'Blue%'", true)
	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.Form["Action"], check.DeepEquals, []string{"Select"})
	c.Assert(req.Form["ConsistentRead"], check.DeepEquals, []string{"true"})

	c.Assert(resp.ResponseMetadata.RequestId, check.Equals, "b1e8f1f7-42e9-494c-ad09-2674e557526d")
	c.Assert(resp.ResponseMetadata.BoxUsage, check.Equals, 0.0000219907)
	c.Assert(len(resp.Items), check.Equals, 2)
	c.Assert(resp.Items[0].Name, check.Equals, "Item_03")
	c.Assert(resp.Items[1].Name, check.Equals, "Item_06")
	c.Assert(resp.Items[0].Attrs[0].Name, check.Equals, "Category")
	c.Assert(resp.Items[0].Attrs[0].Value, check.Equals, "Clothes")

	c.Assert(err, check.IsNil)
}
