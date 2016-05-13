package sdb_test

import (
	"testing"

	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/exp/sdb"
	"github.com/goamz/goamz/testutil"
	. "gopkg.in/check.v1"
)

func Test(t *testing.T) {
	TestingT(t)
}

var _ = Suite(&S{})

type S struct {
	sdb *sdb.SDB
}

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.sdb = sdb.New(auth, aws.Region{SDBEndpoint: testServer.URL})
}

func (s *S) TearDownTest(c *C) {
	testServer.Flush()
}

func (s *S) TestCreateDomainOK(c *C) {
	testServer.Response(200, nil, TestCreateDomainXmlOK)

	domain := s.sdb.Domain("domain")
	resp, err := domain.CreateDomain()
	req := testServer.WaitRequest()

	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Header["Date"], Not(Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, Equals, "63264005-7a5f-e01a-a224-395c63b89f6d")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0055590279)

	c.Assert(err, IsNil)
}

func (s *S) TestListDomainsOK(c *C) {
	testServer.Response(200, nil, TestListDomainsXmlOK)

	resp, err := s.sdb.ListDomains()
	req := testServer.WaitRequest()

	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Header["Date"], Not(Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, Equals, "15fcaf55-9914-63c2-21f3-951e31193790")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0000071759)
	c.Assert(resp.Domains, DeepEquals, []string{"Account", "Domain", "Record"})

	c.Assert(err, IsNil)
}

func (s *S) TestListDomainsWithNextTokenXmlOK(c *C) {
	testServer.Response(200, nil, TestListDomainsWithNextTokenXmlOK)

	resp, err := s.sdb.ListDomains()
	req := testServer.WaitRequest()

	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Header["Date"], Not(Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, Equals, "eb13162f-1b95-4511-8b12-489b86acfd28")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0000219907)
	c.Assert(resp.Domains, DeepEquals, []string{"Domain1-200706011651", "Domain2-200706011652"})
	c.Assert(resp.NextToken, Equals, "TWV0ZXJpbmdUZXN0RG9tYWluMS0yMDA3MDYwMTE2NTY=")

	c.Assert(err, IsNil)
}

func (s *S) TestDeleteDomainOK(c *C) {
	testServer.Response(200, nil, TestDeleteDomainXmlOK)

	domain := s.sdb.Domain("domain")
	resp, err := domain.DeleteDomain()
	req := testServer.WaitRequest()

	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Header["Date"], Not(Equals), "")

	c.Assert(resp.ResponseMetadata.RequestId, Equals, "039e1e25-9a64-2a74-93da-2fda36122a97")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0055590278)

	c.Assert(err, IsNil)
}

func (s *S) TestPutAttrsOK(c *C) {
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
	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Form["Action"], DeepEquals, []string{"PutAttributes"})
	c.Assert(req.Form["ItemName"], DeepEquals, []string{"Item123"})
	c.Assert(req.Form["DomainName"], DeepEquals, []string{"MyDomain"})
	c.Assert(req.Form["Attribute.1.Name"], DeepEquals, []string{"FirstName"})
	c.Assert(req.Form["Attribute.1.Value"], DeepEquals, []string{"john"})
	c.Assert(req.Form["Attribute.2.Name"], DeepEquals, []string{"LastName"})
	c.Assert(req.Form["Attribute.2.Value"], DeepEquals, []string{"smith"})
	c.Assert(req.Form["Attribute.3.Name"], DeepEquals, []string{"MiddleName"})
	c.Assert(req.Form["Attribute.3.Value"], DeepEquals, []string{"jacob"})
	c.Assert(req.Form["Attribute.3.Replace"], DeepEquals, []string{"true"})

	c.Assert(req.Form["Expected.1.Name"], DeepEquals, []string{"FirstName"})
	c.Assert(req.Form["Expected.1.Value"], DeepEquals, []string{"john"})
	c.Assert(req.Form["Expected.1.Exists"], DeepEquals, []string{"false"})

	c.Assert(err, IsNil)
	c.Assert(resp.ResponseMetadata.RequestId, Equals, "490206ce-8292-456c-a00f-61b335eb202b")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0000219907)

}

func (s *S) TestAttrsOK(c *C) {
	testServer.Response(200, nil, TestAttrsXmlOK)

	domain := s.sdb.Domain("MyDomain")
	item := domain.Item("Item123")

	resp, err := item.Attrs(nil, true)
	req := testServer.WaitRequest()

	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Header["Date"], Not(Equals), "")
	c.Assert(req.Form["Action"], DeepEquals, []string{"GetAttributes"})
	c.Assert(req.Form["ItemName"], DeepEquals, []string{"Item123"})
	c.Assert(req.Form["DomainName"], DeepEquals, []string{"MyDomain"})
	c.Assert(req.Form["ConsistentRead"], DeepEquals, []string{"true"})

	c.Assert(resp.Attrs[0].Name, Equals, "Color")
	c.Assert(resp.Attrs[0].Value, Equals, "Blue")
	c.Assert(resp.Attrs[1].Name, Equals, "Size")
	c.Assert(resp.Attrs[1].Value, Equals, "Med")
	c.Assert(resp.ResponseMetadata.RequestId, Equals, "b1e8f1f7-42e9-494c-ad09-2674e557526d")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0000219942)

	c.Assert(err, IsNil)
}

func (s *S) TestAttrsSelectOK(c *C) {
	testServer.Response(200, nil, TestAttrsXmlOK)

	domain := s.sdb.Domain("MyDomain")
	item := domain.Item("Item123")

	resp, err := item.Attrs([]string{"Color", "Size"}, true)
	req := testServer.WaitRequest()

	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Header["Date"], Not(Equals), "")
	c.Assert(req.Form["Action"], DeepEquals, []string{"GetAttributes"})
	c.Assert(req.Form["ItemName"], DeepEquals, []string{"Item123"})
	c.Assert(req.Form["DomainName"], DeepEquals, []string{"MyDomain"})
	c.Assert(req.Form["ConsistentRead"], DeepEquals, []string{"true"})
	c.Assert(req.Form["AttributeName.1"], DeepEquals, []string{"Color"})
	c.Assert(req.Form["AttributeName.2"], DeepEquals, []string{"Size"})

	c.Assert(resp.Attrs[0].Name, Equals, "Color")
	c.Assert(resp.Attrs[0].Value, Equals, "Blue")
	c.Assert(resp.Attrs[1].Name, Equals, "Size")
	c.Assert(resp.Attrs[1].Value, Equals, "Med")
	c.Assert(resp.ResponseMetadata.RequestId, Equals, "b1e8f1f7-42e9-494c-ad09-2674e557526d")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0000219942)

	c.Assert(err, IsNil)
}

func (s *S) TestSelectOK(c *C) {
	testServer.Response(200, nil, TestSelectXmlOK)

	resp, err := s.sdb.Select("select Color from MyDomain where Color like 'Blue%'", true)
	req := testServer.WaitRequest()

	c.Assert(req.Method, Equals, "GET")
	c.Assert(req.URL.Path, Equals, "/")
	c.Assert(req.Header["Date"], Not(Equals), "")
	c.Assert(req.Form["Action"], DeepEquals, []string{"Select"})
	c.Assert(req.Form["ConsistentRead"], DeepEquals, []string{"true"})

	c.Assert(resp.ResponseMetadata.RequestId, Equals, "b1e8f1f7-42e9-494c-ad09-2674e557526d")
	c.Assert(resp.ResponseMetadata.BoxUsage, Equals, 0.0000219907)
	c.Assert(len(resp.Items), Equals, 2)
	c.Assert(resp.Items[0].Name, Equals, "Item_03")
	c.Assert(resp.Items[1].Name, Equals, "Item_06")
	c.Assert(resp.Items[0].Attrs[0].Name, Equals, "Category")
	c.Assert(resp.Items[0].Attrs[0].Value, Equals, "Clothes")

	c.Assert(err, IsNil)
}
