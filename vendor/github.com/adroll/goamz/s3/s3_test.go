package s3_test

import (
	"bytes"
	"io/ioutil"
	"net/http"
	"testing"
	"time"

	"github.com/AdRoll/goamz/aws"
	"github.com/AdRoll/goamz/s3"
	"github.com/AdRoll/goamz/testutil"
	"gopkg.in/check.v1"
)

func Test(t *testing.T) {
	check.TestingT(t)
}

type S struct {
	s3 *s3.S3
}

var _ = check.Suite(&S{})

var testServer = testutil.NewHTTPServer()

func (s *S) SetUpSuite(c *check.C) {
	testServer.Start()
	auth := aws.Auth{AccessKey: "abc", SecretKey: "123"}
	s.s3 = s3.New(auth, aws.Region{Name: "faux-region-1", S3Endpoint: testServer.URL})
}

func (s *S) TearDownSuite(c *check.C) {
	s3.SetAttemptStrategy(nil)
}

func (s *S) SetUpTest(c *check.C) {
	attempts := aws.AttemptStrategy{
		Total: 300 * time.Millisecond,
		Delay: 100 * time.Millisecond,
	}
	s3.SetAttemptStrategy(&attempts)
}

func (s *S) TearDownTest(c *check.C) {
	testServer.Flush()
}

func (s *S) DisableRetries() {
	s3.SetAttemptStrategy(&aws.AttemptStrategy{})
}

// PutBucket docs: http://goo.gl/kBTCu

func (s *S) TestPutBucket(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	err := b.PutBucket(s3.Private)
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
}

// PutBucketWebsite docs: http://goo.gl/TpRlUy

func (s *S) TestPutBucketWebsite(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	config := s3.WebsiteConfiguration{
		RedirectAllRequestsTo: &s3.RedirectAllRequestsTo{HostName: "example.com"},
	}
	err := b.PutBucketWebsite(config)
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	body, err := ioutil.ReadAll(req.Body)
	req.Body.Close()
	c.Assert(err, check.IsNil)
	c.Assert(string(body), check.Equals, BucketWebsiteConfigurationDump)
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/")
	c.Assert(req.URL.RawQuery, check.Equals, "website=")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
}

// Head docs: http://bit.ly/17K1ylI

func (s *S) TestHead(c *check.C) {
	testServer.Response(200, nil, "content")

	b := s.s3.Bucket("bucket")
	resp, err := b.Head("name", nil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "HEAD")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(err, check.IsNil)
	c.Assert(resp.ContentLength, check.FitsTypeOf, int64(0))
	c.Assert(resp, check.FitsTypeOf, &http.Response{})
}

// DeleteBucket docs: http://goo.gl/GoBrY

func (s *S) TestDelBucket(c *check.C) {
	testServer.Response(204, nil, "")

	b := s.s3.Bucket("bucket")
	err := b.DelBucket()
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "DELETE")
	c.Assert(req.URL.Path, check.Equals, "/bucket/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
}

// GetObject docs: http://goo.gl/isCO7

func (s *S) TestGet(c *check.C) {
	testServer.Response(200, nil, "content")

	b := s.s3.Bucket("bucket")
	data, err := b.Get("name")

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	c.Assert(err, check.IsNil)
	c.Assert(string(data), check.Equals, "content")
}

func (s *S) TestGetWithPlus(c *check.C) {
	testServer.Response(200, nil, "content")

	b := s.s3.Bucket("bucket")
	_, err := b.Get("has+plus")

	req := testServer.WaitRequest()
	c.Assert(err, check.IsNil)
	c.Assert(req.RequestURI, check.Equals, "http://localhost:4444/bucket/has%2Bplus")
}

func (s *S) TestURL(c *check.C) {
	testServer.Response(200, nil, "content")

	b := s.s3.Bucket("bucket")
	url := b.URL("name")
	r, err := http.Get(url)
	c.Assert(err, check.IsNil)
	data, err := ioutil.ReadAll(r.Body)
	r.Body.Close()
	c.Assert(err, check.IsNil)
	c.Assert(string(data), check.Equals, "content")

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
}

func (s *S) TestGetReader(c *check.C) {
	testServer.Response(200, nil, "content")

	b := s.s3.Bucket("bucket")
	rc, err := b.GetReader("name")
	c.Assert(err, check.IsNil)
	data, err := ioutil.ReadAll(rc)
	rc.Close()
	c.Assert(err, check.IsNil)
	c.Assert(string(data), check.Equals, "content")

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
}

func (s *S) TestGetNotFound(c *check.C) {
	for i := 0; i < 10; i++ {
		testServer.Response(404, nil, GetObjectErrorDump)
	}

	b := s.s3.Bucket("non-existent-bucket")
	data, err := b.Get("non-existent")

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/non-existent-bucket/non-existent")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")

	s3err, _ := err.(*s3.Error)
	c.Assert(s3err, check.NotNil)
	c.Assert(s3err.StatusCode, check.Equals, 404)
	c.Assert(s3err.BucketName, check.Equals, "non-existent-bucket")
	c.Assert(s3err.RequestId, check.Equals, "3F1B667FAD71C3D8")
	c.Assert(s3err.HostId, check.Equals, "L4ee/zrm1irFXY5F45fKXIRdOf9ktsKY/8TDVawuMK2jWRb1RF84i1uBzkdNqS5D")
	c.Assert(s3err.Code, check.Equals, "NoSuchBucket")
	c.Assert(s3err.Message, check.Equals, "The specified bucket does not exist")
	c.Assert(s3err.Error(), check.Equals, "The specified bucket does not exist")
	c.Assert(data, check.IsNil)
}

// PutObject docs: http://goo.gl/FEBPD

func (s *S) TestPutObject(c *check.C) {
	testServer.Response(200, nil, "")
	const DISPOSITION = "attachment; filename=\"0x1a2b3c.jpg\""

	b := s.s3.Bucket("bucket")
	err := b.Put("name", []byte("content"), "content-type", s3.Private, s3.Options{ContentDisposition: DISPOSITION})
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.DeepEquals), []string{""})
	c.Assert(req.Header["Content-Type"], check.DeepEquals, []string{"content-type"})
	c.Assert(req.Header["Content-Length"], check.DeepEquals, []string{"7"})
	c.Assert(req.Header["Content-Disposition"], check.DeepEquals, []string{DISPOSITION})
	//c.Assert(req.Header["Content-MD5"], gocheck.DeepEquals, "...")
	c.Assert(req.Header["X-Amz-Acl"], check.DeepEquals, []string{"private"})
}

func (s *S) TestPutObjectSSEKMS(c *check.C) {
	testServer.Response(200, nil, "")
	const DISPOSITION = "attachment; filename=\"0x1a2b3c.jpg\""
	const KMSKeyId = "1234xyz"

	s.s3.Signature = aws.V4Signature
	b := s.s3.Bucket("bucket")
	err := b.Put("name", []byte("content"), "content-type", s3.Private, s3.Options{ContentDisposition: DISPOSITION, SSEKMS: true, SSEKMSKeyId: KMSKeyId})
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.DeepEquals), []string{""})
	c.Assert(req.Header["Content-Type"], check.DeepEquals, []string{"content-type"})
	c.Assert(req.Header["Content-Length"], check.DeepEquals, []string{"7"})
	c.Assert(req.Header["Content-Disposition"], check.DeepEquals, []string{DISPOSITION})
	c.Assert(req.Header["X-Amz-Server-Side-Encryption"], check.DeepEquals, []string{string(s3.KMSManaged)})
	c.Assert(req.Header["X-Amz-Server-Side-Encryption-Aws-Kms-Key-Id"], check.DeepEquals, []string{KMSKeyId})
	//c.Assert(req.Header["Content-MD5"], gocheck.DeepEquals, "...")
	c.Assert(req.Header["X-Amz-Acl"], check.DeepEquals, []string{"private"})
}

func (s *S) TestPutObjectReducedRedundancy(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	err := b.Put("name", []byte("content"), "content-type", s3.Private, s3.Options{StorageClass: s3.ReducedRedundancy})
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.DeepEquals), []string{""})
	c.Assert(req.Header["Content-Type"], check.DeepEquals, []string{"content-type"})
	c.Assert(req.Header["Content-Length"], check.DeepEquals, []string{"7"})
	c.Assert(req.Header["X-Amz-Storage-Class"], check.DeepEquals, []string{"REDUCED_REDUNDANCY"})
}

// PutCopy docs: http://goo.gl/mhEHtA
func (s *S) TestPutCopy(c *check.C) {
	testServer.Response(200, nil, PutCopyResultDump)

	b := s.s3.Bucket("bucket")
	res, err := b.PutCopy("name", s3.Private, s3.CopyOptions{},
		// 0xFC is &uuml; - 0xE9 is &eacute;
		"source-bucket/\u00FCber-fil\u00E9.jpg")
	c.Assert(err, check.IsNil)
	c.Assert(res, check.DeepEquals, &s3.CopyObjectResult{
		ETag:         `"9b2cf535f27731c974343645a3985328"`,
		LastModified: `2009-10-28T22:32:00`})

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.DeepEquals), []string{""})
	c.Assert(req.Header["Content-Length"], check.DeepEquals, []string{"0"})
	c.Assert(req.Header["X-Amz-Copy-Source"], check.DeepEquals, []string{`source-bucket/%C3%BCber-fil%C3%A9.jpg`})
	c.Assert(req.Header["X-Amz-Acl"], check.DeepEquals, []string{"private"})
}

func (s *S) TestPutObjectReadTimeout(c *check.C) {
	s.s3.ReadTimeout = 50 * time.Millisecond
	defer func() {
		s.s3.ReadTimeout = 0
	}()

	b := s.s3.Bucket("bucket")
	err := b.Put("name", []byte("content"), "content-type", s3.Private, s3.Options{})

	// Make sure that we get a timeout error.
	c.Assert(err, check.NotNil)

	// Set the response after the request times out so that the next request will work.
	testServer.Response(200, nil, "")

	// This time set the response within our timeout period so that we expect the call
	// to return successfully.
	go func() {
		time.Sleep(25 * time.Millisecond)
		testServer.Response(200, nil, "")
	}()
	err = b.Put("name", []byte("content"), "content-type", s3.Private, s3.Options{})
	c.Assert(err, check.IsNil)
}

func (s *S) TestPutReader(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	buf := bytes.NewBufferString("content")
	err := b.PutReader("name", buf, int64(buf.Len()), "content-type", s3.Private, s3.Options{})
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "PUT")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.DeepEquals), []string{""})
	c.Assert(req.Header["Content-Type"], check.DeepEquals, []string{"content-type"})
	c.Assert(req.Header["Content-Length"], check.DeepEquals, []string{"7"})
	//c.Assert(req.Header["Content-MD5"], gocheck.Equals, "...")
	c.Assert(req.Header["X-Amz-Acl"], check.DeepEquals, []string{"private"})
}

// DelObject docs: http://goo.gl/APeTt

func (s *S) TestDelObject(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	err := b.Del("name")
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "DELETE")
	c.Assert(req.URL.Path, check.Equals, "/bucket/name")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
}

func (s *S) TestDelMultiObjects(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	objects := []s3.Object{s3.Object{Key: "test"}}
	err := b.DelMulti(s3.Delete{
		Quiet:   false,
		Objects: objects,
	})
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "POST")
	c.Assert(req.URL.RawQuery, check.Equals, "delete=")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.Header["Content-MD5"], check.Not(check.Equals), "")
	c.Assert(req.Header["Content-Type"], check.Not(check.Equals), "")
	c.Assert(req.ContentLength, check.Not(check.Equals), "")
}

// Bucket List Objects docs: http://goo.gl/YjQTc

func (s *S) TestList(c *check.C) {
	testServer.Response(200, nil, GetListResultDump1)

	b := s.s3.Bucket("quotes")

	data, err := b.List("N", "", "", 0)
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/quotes/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.Form["prefix"], check.DeepEquals, []string{"N"})
	c.Assert(req.Form["delimiter"], check.DeepEquals, []string{""})
	c.Assert(req.Form["marker"], check.DeepEquals, []string{""})
	c.Assert(req.Form["max-keys"], check.DeepEquals, []string(nil))

	c.Assert(data.Name, check.Equals, "quotes")
	c.Assert(data.Prefix, check.Equals, "N")
	c.Assert(data.IsTruncated, check.Equals, false)
	c.Assert(len(data.Contents), check.Equals, 2)

	c.Assert(data.Contents[0].Key, check.Equals, "Nelson")
	c.Assert(data.Contents[0].LastModified, check.Equals, "2006-01-01T12:00:00.000Z")
	c.Assert(data.Contents[0].ETag, check.Equals, `"828ef3fdfa96f00ad9f27c383fc9ac7f"`)
	c.Assert(data.Contents[0].Size, check.Equals, int64(5))
	c.Assert(data.Contents[0].StorageClass, check.Equals, "STANDARD")
	c.Assert(data.Contents[0].Owner.ID, check.Equals, "bcaf161ca5fb16fd081034f")
	c.Assert(data.Contents[0].Owner.DisplayName, check.Equals, "webfile")

	c.Assert(data.Contents[1].Key, check.Equals, "Neo")
	c.Assert(data.Contents[1].LastModified, check.Equals, "2006-01-01T12:00:00.000Z")
	c.Assert(data.Contents[1].ETag, check.Equals, `"828ef3fdfa96f00ad9f27c383fc9ac7f"`)
	c.Assert(data.Contents[1].Size, check.Equals, int64(4))
	c.Assert(data.Contents[1].StorageClass, check.Equals, "STANDARD")
	c.Assert(data.Contents[1].Owner.ID, check.Equals, "bcaf1ffd86a5fb16fd081034f")
	c.Assert(data.Contents[1].Owner.DisplayName, check.Equals, "webfile")
}

func (s *S) TestListWithDelimiter(c *check.C) {
	testServer.Response(200, nil, GetListResultDump2)

	b := s.s3.Bucket("quotes")

	data, err := b.List("photos/2006/", "/", "some-marker", 1000)
	c.Assert(err, check.IsNil)

	req := testServer.WaitRequest()
	c.Assert(req.Method, check.Equals, "GET")
	c.Assert(req.URL.Path, check.Equals, "/quotes/")
	c.Assert(req.Header["Date"], check.Not(check.Equals), "")
	c.Assert(req.Form["prefix"], check.DeepEquals, []string{"photos/2006/"})
	c.Assert(req.Form["delimiter"], check.DeepEquals, []string{"/"})
	c.Assert(req.Form["marker"], check.DeepEquals, []string{"some-marker"})
	c.Assert(req.Form["max-keys"], check.DeepEquals, []string{"1000"})

	c.Assert(data.Name, check.Equals, "example-bucket")
	c.Assert(data.Prefix, check.Equals, "photos/2006/")
	c.Assert(data.Delimiter, check.Equals, "/")
	c.Assert(data.Marker, check.Equals, "some-marker")
	c.Assert(data.IsTruncated, check.Equals, false)
	c.Assert(len(data.Contents), check.Equals, 0)
	c.Assert(data.CommonPrefixes, check.DeepEquals, []string{"photos/2006/feb/", "photos/2006/jan/"})
}

func (s *S) TestExists(c *check.C) {
	testServer.Response(200, nil, "")

	b := s.s3.Bucket("bucket")
	result, err := b.Exists("name")

	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "HEAD")

	c.Assert(err, check.IsNil)
	c.Assert(result, check.Equals, true)
}

func (s *S) TestExistsNotFound404(c *check.C) {
	testServer.Response(404, nil, "")

	b := s.s3.Bucket("bucket")
	result, err := b.Exists("name")

	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "HEAD")

	c.Assert(err, check.IsNil)
	c.Assert(result, check.Equals, false)
}

func (s *S) TestExistsNotFound403(c *check.C) {
	testServer.Response(403, nil, "")

	b := s.s3.Bucket("bucket")
	result, err := b.Exists("name")

	req := testServer.WaitRequest()

	c.Assert(req.Method, check.Equals, "HEAD")

	c.Assert(err, check.IsNil)
	c.Assert(result, check.Equals, false)
}

func (s *S) TestGetService(c *check.C) {
	testServer.Response(200, nil, GetServiceDump)

	expected := s3.GetServiceResp{
		Owner: s3.Owner{
			ID:          "bcaf1ffd86f461ca5fb16fd081034f",
			DisplayName: "webfile",
		},
		Buckets: []s3.BucketInfo{
			s3.BucketInfo{
				Name:         "quotes",
				CreationDate: "2006-02-03T16:45:09.000Z",
			},
			s3.BucketInfo{
				Name:         "samples",
				CreationDate: "2006-02-03T16:41:58.000Z",
			},
		},
	}

	received, err := s.s3.GetService()

	c.Assert(err, check.IsNil)
	c.Assert(*received, check.DeepEquals, expected)
}

func (s *S) TestLocation(c *check.C) {
	testServer.Response(200, nil, GetLocationUsStandard)
	expectedUsStandard := "us-east-1"

	bucketUsStandard := s.s3.Bucket("us-east-1")
	resultUsStandard, err := bucketUsStandard.Location()

	c.Assert(err, check.IsNil)
	c.Assert(resultUsStandard, check.Equals, expectedUsStandard)

	testServer.Response(200, nil, GetLocationUsWest1)
	expectedUsWest1 := "us-west-1"

	bucketUsWest1 := s.s3.Bucket("us-west-1")
	resultUsWest1, err := bucketUsWest1.Location()

	c.Assert(err, check.IsNil)
	c.Assert(resultUsWest1, check.Equals, expectedUsWest1)
}

func (s *S) TestSupportRadosGW(c *check.C) {
	testServer.Response(200, nil, "content")
	s.s3.Region.Name = "generic"
	b := s.s3.Bucket("bucket")
	_, err := b.Get("rgw")

	req := testServer.WaitRequest()
	c.Assert(err, check.IsNil)
	c.Assert(req.RequestURI, check.Equals, "/bucket/rgw")
}
