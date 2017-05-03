package s3_test

import (
	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/s3"
	"gopkg.in/check.v1"
)

// S3 ReST authentication docs: http://goo.gl/G1LrK

var testAuth = aws.Auth{AccessKey: "0PN5J17HBGZHT7JJ3X82", SecretKey: "uV3F3YluFJax1cknvbcGwgjvx4QpvB+leU8dUj2o"}

func (s *S) TestSignExampleObjectGet(c *check.C) {
	method := "GET"
	path := "/johnsmith/photos/puppy.jpg"
	headers := map[string][]string{
		"Host": {"johnsmith.s3.amazonaws.com"},
		"Date": {"Tue, 27 Mar 2007 19:36:42 +0000"},
	}
	s3.Sign(testAuth, method, path, nil, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:xXjDGYUmKxnwqr5KXNPGldn5LbA="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleObjectPut(c *check.C) {
	method := "PUT"
	path := "/johnsmith/photos/puppy.jpg"
	headers := map[string][]string{
		"Host":           {"johnsmith.s3.amazonaws.com"},
		"Date":           {"Tue, 27 Mar 2007 21:15:45 +0000"},
		"Content-Type":   {"image/jpeg"},
		"Content-Length": {"94328"},
	}
	s3.Sign(testAuth, method, path, nil, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:hcicpDDvL9SsO6AkvxqmIWkmOuQ="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleList(c *check.C) {
	method := "GET"
	path := "/johnsmith/"
	params := map[string][]string{
		"prefix":   {"photos"},
		"max-keys": {"50"},
		"marker":   {"puppy"},
	}
	headers := map[string][]string{
		"Host":       {"johnsmith.s3.amazonaws.com"},
		"Date":       {"Tue, 27 Mar 2007 19:42:41 +0000"},
		"User-Agent": {"Mozilla/5.0"},
	}
	s3.Sign(testAuth, method, path, params, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:jsRt/rhG+Vtp88HrYL706QhE4w4="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleFetch(c *check.C) {
	method := "GET"
	path := "/johnsmith/"
	params := map[string][]string{
		"acl": {""},
	}
	headers := map[string][]string{
		"Host": {"johnsmith.s3.amazonaws.com"},
		"Date": {"Tue, 27 Mar 2007 19:44:46 +0000"},
	}
	s3.Sign(testAuth, method, path, params, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:thdUi9VAkzhkniLj96JIrOPGi0g="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleDelete(c *check.C) {
	method := "DELETE"
	path := "/johnsmith/photos/puppy.jpg"
	params := map[string][]string{}
	headers := map[string][]string{
		"Host":       {"s3.amazonaws.com"},
		"Date":       {"Tue, 27 Mar 2007 21:20:27 +0000"},
		"User-Agent": {"dotnet"},
		"x-amz-date": {"Tue, 27 Mar 2007 21:20:26 +0000"},
	}
	s3.Sign(testAuth, method, path, params, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:k3nL7gH3+PadhTEVn5Ip83xlYzk="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleUpload(c *check.C) {
	method := "PUT"
	path := "/static.johnsmith.net/db-backup.dat.gz"
	params := map[string][]string{}
	headers := map[string][]string{
		"Host":                         {"static.johnsmith.net:8080"},
		"Date":                         {"Tue, 27 Mar 2007 21:06:08 +0000"},
		"User-Agent":                   {"curl/7.15.5"},
		"x-amz-acl":                    {"public-read"},
		"content-type":                 {"application/x-download"},
		"Content-MD5":                  {"4gJE4saaMU4BqNR0kLY+lw=="},
		"X-Amz-Meta-ReviewedBy":        {"joe@johnsmith.net,jane@johnsmith.net"},
		"X-Amz-Meta-FileChecksum":      {"0x02661779"},
		"X-Amz-Meta-ChecksumAlgorithm": {"crc32"},
		"Content-Disposition":          {"attachment; filename=database.dat"},
		"Content-Encoding":             {"gzip"},
		"Content-Length":               {"5913339"},
	}
	s3.Sign(testAuth, method, path, params, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:C0FlOtU8Ylb9KDTpZqYkZPX91iI="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleListAllMyBuckets(c *check.C) {
	method := "GET"
	path := "/"
	headers := map[string][]string{
		"Host": {"s3.amazonaws.com"},
		"Date": {"Wed, 28 Mar 2007 01:29:59 +0000"},
	}
	s3.Sign(testAuth, method, path, nil, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:Db+gepJSUbZKwpx1FR0DLtEYoZA="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleUnicodeKeys(c *check.C) {
	method := "GET"
	path := "/dictionary/fran%C3%A7ais/pr%c3%a9f%c3%a8re"
	headers := map[string][]string{
		"Host": {"s3.amazonaws.com"},
		"Date": {"Wed, 28 Mar 2007 01:49:49 +0000"},
	}
	s3.Sign(testAuth, method, path, nil, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:dxhSBHoI6eVSPcXJqEghlUzZMnY="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}

func (s *S) TestSignExampleCustomSSE(c *check.C) {
	method := "GET"
	path := "/secret/config"
	params := map[string][]string{}
	headers := map[string][]string{
		"Host": {"secret.johnsmith.net:8080"},
		"Date": {"Tue, 27 Mar 2007 21:06:08 +0000"},
		"x-amz-server-side-encryption-customer-key":       {"MWJhakVna1dQT1B0SDFMeGtVVnRQRTFGaU1ldFJrU0I="},
		"x-amz-server-side-encryption-customer-key-MD5":   {"glIqxpqQ4a9aoK/iLttKzQ=="},
		"x-amz-server-side-encryption-customer-algorithm": {"AES256"},
	}
	s3.Sign(testAuth, method, path, params, headers)
	expected := "AWS 0PN5J17HBGZHT7JJ3X82:Xq6PWmIo0aOWq+LDjCEiCGgbmHE="
	c.Assert(headers["Authorization"], check.DeepEquals, []string{expected})
}
