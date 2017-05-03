//
// goamz - Go packages to interact with the Amazon Web Services.
//
//   https://wiki.ubuntu.com/goamz
//
// Copyright (c) 2011 Canonical Ltd.
//
// Written by Gustavo Niemeyer <gustavo.niemeyer@canonical.com>
//

package s3

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/AdRoll/goamz/aws"
)

const debug = false

// The S3 type encapsulates operations with an S3 region.
type S3 struct {
	aws.Auth
	aws.Region
	ConnectTimeout time.Duration
	ReadTimeout    time.Duration
	Signature      int
	private        byte // Reserve the right of using private data.
}

// The Bucket type encapsulates operations with an S3 bucket.
type Bucket struct {
	*S3
	Name string
}

// The Owner type represents the owner of the object in an S3 bucket.
type Owner struct {
	ID          string
	DisplayName string
}

// Fold options into an Options struct
//
type Options struct {
	SSE                  bool
	SSEKMS               bool
	SSEKMSKeyId          string
	SSECustomerAlgorithm string
	SSECustomerKey       string
	SSECustomerKeyMD5    string
	Meta                 map[string][]string
	ContentEncoding      string
	CacheControl         string
	RedirectLocation     string
	ContentMD5           string
	ContentDisposition   string
	Range                string
	StorageClass         StorageClass
	// What else?
}

type CopyOptions struct {
	Options
	CopySourceOptions string
	MetadataDirective string
	ContentType       string
}

// CopyObjectResult is the output from a Copy request
type CopyObjectResult struct {
	ETag         string
	LastModified string
}

var attempts = aws.AttemptStrategy{
	Min:   5,
	Total: 5 * time.Second,
	Delay: 200 * time.Millisecond,
}

// New creates a new S3.
func New(auth aws.Auth, region aws.Region) *S3 {
	return &S3{auth, region, 0, 0, aws.V2Signature, 0}
}

// Bucket returns a Bucket with the given name.
func (s3 *S3) Bucket(name string) *Bucket {
	if s3.Region.S3BucketEndpoint != "" || s3.Region.S3LowercaseBucket {
		name = strings.ToLower(name)
	}
	return &Bucket{s3, name}
}

type BucketInfo struct {
	Name         string
	CreationDate string
}

type GetServiceResp struct {
	Owner   Owner
	Buckets []BucketInfo `xml:">Bucket"`
}

// GetService gets a list of all buckets owned by an account.
//
// See http://goo.gl/wbHkGj for details.
func (s3 *S3) GetService() (*GetServiceResp, error) {
	bucket := s3.Bucket("")

	r, err := bucket.Get("")
	if err != nil {
		return nil, err
	}

	// Parse the XML response.
	var resp GetServiceResp
	if err = xml.Unmarshal(r, &resp); err != nil {
		return nil, err
	}

	return &resp, nil
}

var createBucketConfiguration = `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <LocationConstraint>%s</LocationConstraint>
</CreateBucketConfiguration>`

// locationConstraint returns an io.Reader specifying a LocationConstraint if
// required for the region.
//
// See http://goo.gl/bh9Kq for details.
func (s3 *S3) locationConstraint() io.Reader {
	constraint := ""
	if s3.Region.S3LocationConstraint {
		constraint = fmt.Sprintf(createBucketConfiguration, s3.Region.Name)
	}
	return strings.NewReader(constraint)
}

type ACL string

const (
	Private           = ACL("private")
	PublicRead        = ACL("public-read")
	PublicReadWrite   = ACL("public-read-write")
	AuthenticatedRead = ACL("authenticated-read")
	BucketOwnerRead   = ACL("bucket-owner-read")
	BucketOwnerFull   = ACL("bucket-owner-full-control")
)

type StorageClass string

const (
	ReducedRedundancy = StorageClass("REDUCED_REDUNDANCY")
	StandardStorage   = StorageClass("STANDARD")
)

type ServerSideEncryption string

const (
	S3Managed  = ServerSideEncryption("AES256")
	KMSManaged = ServerSideEncryption("aws:kms")
)

// PutBucket creates a new bucket.
//
// See http://goo.gl/ndjnR for details.
func (b *Bucket) PutBucket(perm ACL) error {
	headers := map[string][]string{
		"x-amz-acl": {string(perm)},
	}
	req := &request{
		method:  "PUT",
		bucket:  b.Name,
		path:    "/",
		headers: headers,
		payload: b.locationConstraint(),
	}
	return b.S3.query(req, nil)
}

// DelBucket removes an existing S3 bucket. All objects in the bucket must
// be removed before the bucket itself can be removed.
//
// See http://goo.gl/GoBrY for details.
func (b *Bucket) DelBucket() (err error) {
	req := &request{
		method: "DELETE",
		bucket: b.Name,
		path:   "/",
	}
	for attempt := attempts.Start(); attempt.Next(); {
		err = b.S3.query(req, nil)
		if !shouldRetry(err) {
			break
		}
	}
	return err
}

// Get retrieves an object from an S3 bucket.
//
// See http://goo.gl/isCO7 for details.
func (b *Bucket) Get(path string) (data []byte, err error) {
	body, err := b.GetReader(path)
	if err != nil {
		return nil, err
	}
	data, err = ioutil.ReadAll(body)
	body.Close()
	return data, err
}

// GetReader retrieves an object from an S3 bucket,
// returning the body of the HTTP response.
// It is the caller's responsibility to call Close on rc when
// finished reading.
func (b *Bucket) GetReader(path string) (rc io.ReadCloser, err error) {
	resp, err := b.GetResponse(path)
	if resp != nil {
		return resp.Body, err
	}
	return nil, err
}

// GetResponse retrieves an object from an S3 bucket,
// returning the HTTP response.
// It is the caller's responsibility to call Close on rc when
// finished reading
func (b *Bucket) GetResponse(path string) (resp *http.Response, err error) {
	return b.GetResponseWithHeaders(path, make(http.Header))
}

// GetReaderWithHeaders retrieves an object from an S3 bucket
// Accepts custom headers to be sent as the second parameter
// returning the body of the HTTP response.
// It is the caller's responsibility to call Close on rc when
// finished reading
func (b *Bucket) GetResponseWithHeaders(path string, headers map[string][]string) (resp *http.Response, err error) {
	req := &request{
		bucket:  b.Name,
		path:    path,
		headers: headers,
	}
	err = b.S3.prepare(req)
	if err != nil {
		return nil, err
	}
	for attempt := attempts.Start(); attempt.Next(); {
		resp, err := b.S3.run(req, nil)
		if shouldRetry(err) && attempt.HasNext() {
			continue
		}
		if err != nil {
			return nil, err
		}
		return resp, nil
	}
	panic("unreachable")
}

// Exists checks whether or not an object exists on an S3 bucket using a HEAD request.
func (b *Bucket) Exists(path string) (exists bool, err error) {
	req := &request{
		method: "HEAD",
		bucket: b.Name,
		path:   path,
	}
	err = b.S3.prepare(req)
	if err != nil {
		return
	}
	for attempt := attempts.Start(); attempt.Next(); {
		resp, err := b.S3.run(req, nil)

		if shouldRetry(err) && attempt.HasNext() {
			continue
		}

		if err != nil {
			// We can treat a 403 or 404 as non existance
			if e, ok := err.(*Error); ok && (e.StatusCode == 403 || e.StatusCode == 404) {
				return false, nil
			}
			return false, err
		}

		if resp.StatusCode/100 == 2 {
			exists = true
		}
		if resp.Body != nil {
			resp.Body.Close()
		}
		return exists, err
	}
	return false, fmt.Errorf("S3 Currently Unreachable")
}

// Head HEADs an object in the S3 bucket, returns the response with
// no body see http://bit.ly/17K1ylI
func (b *Bucket) Head(path string, headers map[string][]string) (*http.Response, error) {
	req := &request{
		method:  "HEAD",
		bucket:  b.Name,
		path:    path,
		headers: headers,
	}
	err := b.S3.prepare(req)
	if err != nil {
		return nil, err
	}

	for attempt := attempts.Start(); attempt.Next(); {
		resp, err := b.S3.run(req, nil)
		if shouldRetry(err) && attempt.HasNext() {
			continue
		}
		if err != nil {
			return nil, err
		}
		return resp, err
	}
	return nil, fmt.Errorf("S3 Currently Unreachable")
}

// Put inserts an object into the S3 bucket.
//
// See http://goo.gl/FEBPD for details.
func (b *Bucket) Put(path string, data []byte, contType string, perm ACL, options Options) error {
	body := bytes.NewBuffer(data)
	return b.PutReader(path, body, int64(len(data)), contType, perm, options)
}

// PutCopy puts a copy of an object given by the key path into bucket b using b.Path as the target key
func (b *Bucket) PutCopy(path string, perm ACL, options CopyOptions, source string) (*CopyObjectResult, error) {
	headers := map[string][]string{
		"x-amz-acl":         {string(perm)},
		"x-amz-copy-source": {escapePath(source)},
	}
	options.addHeaders(headers)
	req := &request{
		method:  "PUT",
		bucket:  b.Name,
		path:    path,
		headers: headers,
	}
	resp := &CopyObjectResult{}
	err := b.S3.query(req, resp)
	if err != nil {
		return resp, err
	}
	return resp, nil
}

// PutReader inserts an object into the S3 bucket by consuming data
// from r until EOF.
func (b *Bucket) PutReader(path string, r io.Reader, length int64, contType string, perm ACL, options Options) error {
	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(length, 10)},
		"Content-Type":   {contType},
		"x-amz-acl":      {string(perm)},
	}
	options.addHeaders(headers)
	req := &request{
		method:  "PUT",
		bucket:  b.Name,
		path:    path,
		headers: headers,
		payload: r,
	}
	return b.S3.query(req, nil)
}

// addHeaders adds o's specified fields to headers
func (o Options) addHeaders(headers map[string][]string) {
	if o.SSE {
		headers["x-amz-server-side-encryption"] = []string{string(S3Managed)}
	} else if o.SSEKMS {
		headers["x-amz-server-side-encryption"] = []string{string(KMSManaged)}
		if len(o.SSEKMSKeyId) != 0 {
			headers["x-amz-server-side-encryption-aws-kms-key-id"] = []string{o.SSEKMSKeyId}
		}
	} else if len(o.SSECustomerAlgorithm) != 0 && len(o.SSECustomerKey) != 0 && len(o.SSECustomerKeyMD5) != 0 {
		// Amazon-managed keys and customer-managed keys are mutually exclusive
		headers["x-amz-server-side-encryption-customer-algorithm"] = []string{o.SSECustomerAlgorithm}
		headers["x-amz-server-side-encryption-customer-key"] = []string{o.SSECustomerKey}
		headers["x-amz-server-side-encryption-customer-key-MD5"] = []string{o.SSECustomerKeyMD5}
	}
	if len(o.Range) != 0 {
		headers["Range"] = []string{o.Range}
	}
	if len(o.ContentEncoding) != 0 {
		headers["Content-Encoding"] = []string{o.ContentEncoding}
	}
	if len(o.CacheControl) != 0 {
		headers["Cache-Control"] = []string{o.CacheControl}
	}
	if len(o.ContentMD5) != 0 {
		headers["Content-MD5"] = []string{o.ContentMD5}
	}
	if len(o.RedirectLocation) != 0 {
		headers["x-amz-website-redirect-location"] = []string{o.RedirectLocation}
	}
	if len(o.ContentDisposition) != 0 {
		headers["Content-Disposition"] = []string{o.ContentDisposition}
	}
	if len(o.StorageClass) != 0 {
		headers["x-amz-storage-class"] = []string{string(o.StorageClass)}

	}
	for k, v := range o.Meta {
		headers["x-amz-meta-"+k] = v
	}
}

// addHeaders adds o's specified fields to headers
func (o CopyOptions) addHeaders(headers map[string][]string) {
	o.Options.addHeaders(headers)
	if len(o.MetadataDirective) != 0 {
		headers["x-amz-metadata-directive"] = []string{o.MetadataDirective}
	}
	if len(o.CopySourceOptions) != 0 {
		headers["x-amz-copy-source-range"] = []string{o.CopySourceOptions}
	}
	if len(o.ContentType) != 0 {
		headers["Content-Type"] = []string{o.ContentType}
	}
}

func makeXmlBuffer(doc []byte) *bytes.Buffer {
	buf := new(bytes.Buffer)
	buf.WriteString(xml.Header)
	buf.Write(doc)
	return buf
}

type IndexDocument struct {
	Suffix string `xml:"Suffix"`
}

type ErrorDocument struct {
	Key string `xml:"Key"`
}

type RoutingRule struct {
	ConditionKeyPrefixEquals     string `xml:"Condition>KeyPrefixEquals"`
	RedirectReplaceKeyPrefixWith string `xml:"Redirect>ReplaceKeyPrefixWith,omitempty"`
	RedirectReplaceKeyWith       string `xml:"Redirect>ReplaceKeyWith,omitempty"`
}

type RedirectAllRequestsTo struct {
	HostName string `xml:"HostName"`
	Protocol string `xml:"Protocol,omitempty"`
}

type WebsiteConfiguration struct {
	XMLName               xml.Name               `xml:"http://s3.amazonaws.com/doc/2006-03-01/ WebsiteConfiguration"`
	IndexDocument         *IndexDocument         `xml:"IndexDocument,omitempty"`
	ErrorDocument         *ErrorDocument         `xml:"ErrorDocument,omitempty"`
	RoutingRules          *[]RoutingRule         `xml:"RoutingRules>RoutingRule,omitempty"`
	RedirectAllRequestsTo *RedirectAllRequestsTo `xml:"RedirectAllRequestsTo,omitempty"`
}

// PutBucketWebsite configures a bucket as a website.
//
// See http://goo.gl/TpRlUy for details.
func (b *Bucket) PutBucketWebsite(configuration WebsiteConfiguration) error {
	doc, err := xml.Marshal(configuration)
	if err != nil {
		return err
	}

	buf := makeXmlBuffer(doc)

	return b.PutBucketSubresource("website", buf, int64(buf.Len()))
}

func (b *Bucket) PutBucketSubresource(subresource string, r io.Reader, length int64) error {
	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(length, 10)},
	}
	req := &request{
		path:    "/",
		method:  "PUT",
		bucket:  b.Name,
		headers: headers,
		payload: r,
		params:  url.Values{subresource: {""}},
	}

	return b.S3.query(req, nil)
}

// Del removes an object from the S3 bucket.
//
// See http://goo.gl/APeTt for details.
func (b *Bucket) Del(path string) error {
	req := &request{
		method: "DELETE",
		bucket: b.Name,
		path:   path,
	}
	return b.S3.query(req, nil)
}

type Delete struct {
	Quiet   bool     `xml:"Quiet,omitempty"`
	Objects []Object `xml:"Object"`
}

type Object struct {
	Key       string `xml:"Key"`
	VersionId string `xml:"VersionId,omitempty"`
}

// DelMulti removes up to 1000 objects from the S3 bucket.
//
// See http://goo.gl/jx6cWK for details.
func (b *Bucket) DelMulti(objects Delete) error {
	doc, err := xml.Marshal(objects)
	if err != nil {
		return err
	}

	buf := makeXmlBuffer(doc)
	digest := md5.New()
	size, err := digest.Write(buf.Bytes())
	if err != nil {
		return err
	}

	headers := map[string][]string{
		"Content-Length": {strconv.FormatInt(int64(size), 10)},
		"Content-MD5":    {base64.StdEncoding.EncodeToString(digest.Sum(nil))},
		"Content-Type":   {"text/xml"},
	}
	req := &request{
		path:    "/",
		method:  "POST",
		params:  url.Values{"delete": {""}},
		bucket:  b.Name,
		headers: headers,
		payload: buf,
	}

	return b.S3.query(req, nil)
}

// The ListResp type holds the results of a List bucket operation.
type ListResp struct {
	Name      string
	Prefix    string
	Delimiter string
	Marker    string
	MaxKeys   int
	// IsTruncated is true if the results have been truncated because
	// there are more keys and prefixes than can fit in MaxKeys.
	// N.B. this is the opposite sense to that documented (incorrectly) in
	// http://goo.gl/YjQTc
	IsTruncated    bool
	Contents       []Key
	CommonPrefixes []string `xml:">Prefix"`
	// if IsTruncated is true, pass NextMarker as marker argument to List()
	// to get the next set of keys
	NextMarker string
}

// The Key type represents an item stored in an S3 bucket.
type Key struct {
	Key          string
	LastModified string
	Size         int64
	// ETag gives the hex-encoded MD5 sum of the contents,
	// surrounded with double-quotes.
	ETag         string
	StorageClass string
	Owner        Owner
}

// List returns information about objects in an S3 bucket.
//
// The prefix parameter limits the response to keys that begin with the
// specified prefix.
//
// The delim parameter causes the response to group all of the keys that
// share a common prefix up to the next delimiter in a single entry within
// the CommonPrefixes field. You can use delimiters to separate a bucket
// into different groupings of keys, similar to how folders would work.
//
// The marker parameter specifies the key to start with when listing objects
// in a bucket. Amazon S3 lists objects in alphabetical order and
// will return keys alphabetically greater than the marker.
//
// The max parameter specifies how many keys + common prefixes to return in
// the response. The default is 1000.
//
// For example, given these keys in a bucket:
//
//     index.html
//     index2.html
//     photos/2006/January/sample.jpg
//     photos/2006/February/sample2.jpg
//     photos/2006/February/sample3.jpg
//     photos/2006/February/sample4.jpg
//
// Listing this bucket with delimiter set to "/" would yield the
// following result:
//
//     &ListResp{
//         Name:      "sample-bucket",
//         MaxKeys:   1000,
//         Delimiter: "/",
//         Contents:  []Key{
//             {Key: "index.html", "index2.html"},
//         },
//         CommonPrefixes: []string{
//             "photos/",
//         },
//     }
//
// Listing the same bucket with delimiter set to "/" and prefix set to
// "photos/2006/" would yield the following result:
//
//     &ListResp{
//         Name:      "sample-bucket",
//         MaxKeys:   1000,
//         Delimiter: "/",
//         Prefix:    "photos/2006/",
//         CommonPrefixes: []string{
//             "photos/2006/February/",
//             "photos/2006/January/",
//         },
//     }
//
// See http://goo.gl/YjQTc for details.
func (b *Bucket) List(prefix, delim, marker string, max int) (result *ListResp, err error) {
	params := map[string][]string{
		"prefix":    {prefix},
		"delimiter": {delim},
		"marker":    {marker},
	}
	if max != 0 {
		params["max-keys"] = []string{strconv.FormatInt(int64(max), 10)}
	}
	req := &request{
		bucket: b.Name,
		params: params,
	}
	result = &ListResp{}
	for attempt := attempts.Start(); attempt.Next(); {
		err = b.S3.query(req, result)
		if !shouldRetry(err) {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	// if NextMarker is not returned, it should be set to the name of last key,
	// so let's do it so that each caller doesn't have to
	if result.IsTruncated && result.NextMarker == "" {
		n := len(result.Contents)
		if n > 0 {
			result.NextMarker = result.Contents[n-1].Key
		}
	}
	return result, nil
}

// The VersionsResp type holds the results of a list bucket Versions operation.
type VersionsResp struct {
	Name            string
	Prefix          string
	KeyMarker       string
	VersionIdMarker string
	MaxKeys         int
	Delimiter       string
	IsTruncated     bool
	Versions        []Version `xml:"Version"`
	CommonPrefixes  []string  `xml:">Prefix"`
}

// The Version type represents an object version stored in an S3 bucket.
type Version struct {
	Key          string
	VersionId    string
	IsLatest     bool
	LastModified string
	// ETag gives the hex-encoded MD5 sum of the contents,
	// surrounded with double-quotes.
	ETag         string
	Size         int64
	Owner        Owner
	StorageClass string
}

func (b *Bucket) Versions(prefix, delim, keyMarker string, versionIdMarker string, max int) (result *VersionsResp, err error) {
	params := map[string][]string{
		"versions":  {""},
		"prefix":    {prefix},
		"delimiter": {delim},
	}

	if len(versionIdMarker) != 0 {
		params["version-id-marker"] = []string{versionIdMarker}
	}
	if len(keyMarker) != 0 {
		params["key-marker"] = []string{keyMarker}
	}

	if max != 0 {
		params["max-keys"] = []string{strconv.FormatInt(int64(max), 10)}
	}
	req := &request{
		bucket: b.Name,
		params: params,
	}
	result = &VersionsResp{}
	for attempt := attempts.Start(); attempt.Next(); {
		err = b.S3.query(req, result)
		if !shouldRetry(err) {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

type GetLocationResp struct {
	Location string `xml:",innerxml"`
}

func (b *Bucket) Location() (string, error) {
	r, err := b.Get("/?location")
	if err != nil {
		return "", err
	}

	// Parse the XML response.
	var resp GetLocationResp
	if err = xml.Unmarshal(r, &resp); err != nil {
		return "", err
	}

	if resp.Location == "" {
		return "us-east-1", nil
	} else {
		return resp.Location, nil
	}
}

// URL returns a non-signed URL that allows retriving the
// object at path. It only works if the object is publicly
// readable (see SignedURL).
func (b *Bucket) URL(path string) string {
	req := &request{
		bucket: b.Name,
		path:   path,
	}
	err := b.S3.prepare(req)
	if err != nil {
		panic(err)
	}
	u, err := req.url()
	if err != nil {
		panic(err)
	}
	u.RawQuery = ""
	return u.String()
}

// SignedURL returns a signed URL that allows anyone holding the URL
// to retrieve the object at path. The signature is valid until expires.
func (b *Bucket) SignedURL(path string, expires time.Time) string {
	return b.SignedURLWithArgs(path, expires, nil, nil)
}

// SignedURLWithArgs returns a signed URL that allows anyone holding the URL
// to retrieve the object at path. The signature is valid until expires.
func (b *Bucket) SignedURLWithArgs(path string, expires time.Time, params url.Values, headers http.Header) string {
	return b.SignedURLWithMethod("GET", path, expires, params, headers)
}

// SignedURLWithMethod returns a signed URL that allows anyone holding the URL
// to either retrieve the object at path or make a HEAD request against it. The signature is valid until expires.
func (b *Bucket) SignedURLWithMethod(method, path string, expires time.Time, params url.Values, headers http.Header) string {
	var uv = url.Values{}

	if params != nil {
		uv = params
	}

	if b.S3.Signature == aws.V2Signature {
		uv.Set("Expires", strconv.FormatInt(expires.Unix(), 10))
	} else {
		uv.Set("X-Amz-Expires", strconv.FormatInt(expires.Unix()-time.Now().Unix(), 10))
	}

	req := &request{
		method:  method,
		bucket:  b.Name,
		path:    path,
		params:  uv,
		headers: headers,
	}
	err := b.S3.prepare(req)
	if err != nil {
		panic(err)
	}
	u, err := req.url()
	if err != nil {
		panic(err)
	}
	if b.S3.Auth.Token() != "" && b.S3.Signature == aws.V2Signature {
		return u.String() + "&x-amz-security-token=" + url.QueryEscape(req.headers["X-Amz-Security-Token"][0])
	} else {
		return u.String()
	}
}

// UploadSignedURL returns a signed URL that allows anyone holding the URL
// to upload the object at path. The signature is valid until expires.
// contenttype is a string like image/png
// name is the resource name in s3 terminology like images/ali.png [obviously excluding the bucket name itself]
func (b *Bucket) UploadSignedURL(name, method, content_type string, expires time.Time) string {
	expire_date := expires.Unix()
	if method != "POST" {
		method = "PUT"
	}

	a := b.S3.Auth
	tokenData := ""

	if a.Token() != "" {
		tokenData = "x-amz-security-token:" + a.Token() + "\n"
	}

	stringToSign := method + "\n\n" + content_type + "\n" + strconv.FormatInt(expire_date, 10) + "\n" + tokenData + "/" + path.Join(b.Name, name)
	secretKey := a.SecretKey
	accessId := a.AccessKey
	mac := hmac.New(sha1.New, []byte(secretKey))
	mac.Write([]byte(stringToSign))
	macsum := mac.Sum(nil)
	signature := base64.StdEncoding.EncodeToString([]byte(macsum))
	signature = strings.TrimSpace(signature)

	var signedurl *url.URL
	var err error
	if b.Region.S3Endpoint != "" {
		signedurl, err = url.Parse(b.Region.S3Endpoint)
		name = b.Name + "/" + name
	} else {
		signedurl, err = url.Parse("https://" + b.Name + ".s3.amazonaws.com/")
	}

	if err != nil {
		log.Println("ERROR sining url for S3 upload", err)
		return ""
	}
	signedurl.Path = name
	params := url.Values{}
	params.Add("AWSAccessKeyId", accessId)
	params.Add("Expires", strconv.FormatInt(expire_date, 10))
	params.Add("Signature", signature)
	if a.Token() != "" {
		params.Add("x-amz-security-token", a.Token())
	}

	signedurl.RawQuery = params.Encode()
	return signedurl.String()
}

// PostFormArgs returns the action and input fields needed to allow anonymous
// uploads to a bucket within the expiration limit
// Additional conditions can be specified with conds
func (b *Bucket) PostFormArgsEx(path string, expires time.Time, redirect string, conds []string) (action string, fields map[string]string) {
	conditions := make([]string, 0)
	fields = map[string]string{
		"AWSAccessKeyId": b.Auth.AccessKey,
		"key":            path,
	}

	if token := b.S3.Auth.Token(); token != "" {
		fields["x-amz-security-token"] = token
		conditions = append(conditions,
			fmt.Sprintf("{\"x-amz-security-token\": \"%s\"}", token))
	}

	if conds != nil {
		conditions = append(conditions, conds...)
	}

	conditions = append(conditions, fmt.Sprintf("{\"key\": \"%s\"}", path))
	conditions = append(conditions, fmt.Sprintf("{\"bucket\": \"%s\"}", b.Name))
	if redirect != "" {
		conditions = append(conditions, fmt.Sprintf("{\"success_action_redirect\": \"%s\"}", redirect))
		fields["success_action_redirect"] = redirect
	}

	vExpiration := expires.Format("2006-01-02T15:04:05Z")
	vConditions := strings.Join(conditions, ",")
	policy := fmt.Sprintf("{\"expiration\": \"%s\", \"conditions\": [%s]}", vExpiration, vConditions)
	policy64 := base64.StdEncoding.EncodeToString([]byte(policy))
	fields["policy"] = policy64

	signer := hmac.New(sha1.New, []byte(b.Auth.SecretKey))
	signer.Write([]byte(policy64))
	fields["signature"] = base64.StdEncoding.EncodeToString(signer.Sum(nil))

	action = fmt.Sprintf("%s/%s/", b.S3.Region.S3Endpoint, b.Name)
	return
}

// PostFormArgs returns the action and input fields needed to allow anonymous
// uploads to a bucket within the expiration limit
func (b *Bucket) PostFormArgs(path string, expires time.Time, redirect string) (action string, fields map[string]string) {
	return b.PostFormArgsEx(path, expires, redirect, nil)
}

type request struct {
	method   string
	bucket   string
	path     string
	params   url.Values
	headers  http.Header
	baseurl  string
	payload  io.Reader
	prepared bool
}

func (req *request) url() (*url.URL, error) {
	u, err := url.Parse(req.baseurl)
	if err != nil {
		return nil, fmt.Errorf("bad S3 endpoint URL %q: %v", req.baseurl, err)
	}
	u.RawQuery = req.params.Encode()
	u.Path = req.path
	return u, nil
}

// query prepares and runs the req request.
// If resp is not nil, the XML data contained in the response
// body will be unmarshalled on it.
func (s3 *S3) query(req *request, resp interface{}) error {
	err := s3.prepare(req)
	if err != nil {
		return err
	}
	r, err := s3.run(req, resp)
	if r != nil && r.Body != nil {
		r.Body.Close()
	}
	return err
}

// queryV4Signprepares and runs the req request, signed with aws v4 signatures.
// If resp is not nil, the XML data contained in the response
// body will be unmarshalled on it.
func (s3 *S3) queryV4Sign(req *request, resp interface{}) error {
	if req.headers == nil {
		req.headers = map[string][]string{}
	}

	err := s3.setBaseURL(req)
	if err != nil {
		return err
	}

	hreq, err := s3.setupHttpRequest(req)
	if err != nil {
		return err
	}

	// req.Host must be set for V4 signature calculation
	hreq.Host = hreq.URL.Host

	signer := aws.NewV4Signer(s3.Auth, "s3", s3.Region)
	signer.IncludeXAmzContentSha256 = true
	signer.Sign(hreq)

	_, err = s3.doHttpRequest(hreq, resp)
	return err
}

// Sets baseurl on req from bucket name and the region endpoint
func (s3 *S3) setBaseURL(req *request) error {
	if req.bucket == "" {
		req.baseurl = s3.Region.S3Endpoint
	} else {
		req.baseurl = s3.Region.S3BucketEndpoint
		if req.baseurl == "" {
			// Use the path method to address the bucket.
			req.baseurl = s3.Region.S3Endpoint
			req.path = "/" + req.bucket + req.path
		} else {
			// Just in case, prevent injection.
			if strings.IndexAny(req.bucket, "/:@") >= 0 {
				return fmt.Errorf("bad S3 bucket: %q", req.bucket)
			}
			req.baseurl = strings.Replace(req.baseurl, "${bucket}", req.bucket, -1)
		}
	}

	return nil
}

// partiallyEscapedPath partially escapes the S3 path allowing for all S3 REST API calls.
//
// Some commands including:
//      GET Bucket acl              http://goo.gl/aoXflF
//      GET Bucket cors             http://goo.gl/UlmBdx
//      GET Bucket lifecycle        http://goo.gl/8Fme7M
//      GET Bucket policy           http://goo.gl/ClXIo3
//      GET Bucket location         http://goo.gl/5lh8RD
//      GET Bucket Logging          http://goo.gl/sZ5ckF
//      GET Bucket notification     http://goo.gl/qSSZKD
//      GET Bucket tagging          http://goo.gl/QRvxnM
// require the first character after the bucket name in the path to be a literal '?' and
// not the escaped hex representation '%3F'.
func partiallyEscapedPath(path string) string {
	pathEscapedAndSplit := strings.Split((&url.URL{Path: path}).String(), "/")
	if len(pathEscapedAndSplit) >= 3 {
		if len(pathEscapedAndSplit[2]) >= 3 {
			// Check for the one "?" that should not be escaped.
			if pathEscapedAndSplit[2][0:3] == "%3F" {
				pathEscapedAndSplit[2] = "?" + pathEscapedAndSplit[2][3:]
			}
		}
	}
	return strings.Replace(strings.Join(pathEscapedAndSplit, "/"), "+", "%2B", -1)
}

// prepare sets up req to be delivered to S3.
func (s3 *S3) prepare(req *request) error {
	// Copy so they can be mutated without affecting on retries.
	params := make(url.Values)
	headers := make(http.Header)
	for k, v := range req.params {
		params[k] = v
	}
	for k, v := range req.headers {
		headers[k] = v
	}
	req.params = params
	req.headers = headers

	if !req.prepared {
		req.prepared = true
		if req.method == "" {
			req.method = "GET"
		}

		if !strings.HasPrefix(req.path, "/") {
			req.path = "/" + req.path
		}

		err := s3.setBaseURL(req)
		if err != nil {
			return err
		}
	}

	if s3.Signature == aws.V2Signature && s3.Auth.Token() != "" {
		req.headers["X-Amz-Security-Token"] = []string{s3.Auth.Token()}
	} else if s3.Auth.Token() != "" {
		req.params.Set("X-Amz-Security-Token", s3.Auth.Token())
	}

	if s3.Signature == aws.V2Signature {
		// Always sign again as it's not clear how far the
		// server has handled a previous attempt.
		u, err := url.Parse(req.baseurl)
		if err != nil {
			return err
		}

		signpathPartiallyEscaped := partiallyEscapedPath(req.path)
		if strings.IndexAny(s3.Region.S3BucketEndpoint, "${bucket}") >= 0 {
			signpathPartiallyEscaped = "/" + req.bucket + signpathPartiallyEscaped
		}
		req.headers["Host"] = []string{u.Host}
		req.headers["Date"] = []string{time.Now().In(time.UTC).Format(time.RFC1123)}

		sign(s3.Auth, req.method, signpathPartiallyEscaped, req.params, req.headers)
	} else {
		hreq, err := s3.setupHttpRequest(req)
		if err != nil {
			return err
		}

		hreq.Host = hreq.URL.Host
		signer := aws.NewV4Signer(s3.Auth, "s3", s3.Region)
		signer.IncludeXAmzContentSha256 = true
		signer.Sign(hreq)

		req.payload = hreq.Body
		if _, ok := headers["Content-Length"]; ok {
			req.headers["Content-Length"] = headers["Content-Length"]
		}
	}
	return nil
}

// Prepares an *http.Request for doHttpRequest
func (s3 *S3) setupHttpRequest(req *request) (*http.Request, error) {
	// Copy so that signing the http request will not mutate it
	headers := make(http.Header)
	for k, v := range req.headers {
		headers[k] = v
	}
	req.headers = headers

	u, err := req.url()
	if err != nil {
		return nil, err
	}
	if s3.Region.Name != "generic" {
		u.Opaque = fmt.Sprintf("//%s%s", u.Host, partiallyEscapedPath(u.Path))
	}

	hreq := http.Request{
		URL:        u,
		Method:     req.method,
		ProtoMajor: 1,
		ProtoMinor: 1,
		Close:      true,
		Header:     req.headers,
		Form:       req.params,
	}

	if v, ok := req.headers["Content-Length"]; ok {
		hreq.ContentLength, _ = strconv.ParseInt(v[0], 10, 64)
		delete(req.headers, "Content-Length")
	}
	if req.payload != nil {
		hreq.Body = ioutil.NopCloser(req.payload)
	}

	return &hreq, nil
}

// doHttpRequest sends hreq and returns the http response from the server.
// If resp is not nil, the XML data contained in the response
// body will be unmarshalled on it.
func (s3 *S3) doHttpRequest(hreq *http.Request, resp interface{}) (*http.Response, error) {
	c := http.Client{
		Transport: &http.Transport{
			Dial: func(netw, addr string) (c net.Conn, err error) {
				deadline := time.Now().Add(s3.ReadTimeout)
				if s3.ConnectTimeout > 0 {
					c, err = net.DialTimeout(netw, addr, s3.ConnectTimeout)
				} else {
					c, err = net.Dial(netw, addr)
				}
				if err != nil {
					return
				}
				if s3.ReadTimeout > 0 {
					err = c.SetDeadline(deadline)
				}
				return
			},
			Proxy: http.ProxyFromEnvironment,
		},
	}

	hresp, err := c.Do(hreq)
	if err != nil {
		return nil, err
	}
	if debug {
		dump, _ := httputil.DumpResponse(hresp, true)
		log.Printf("} -> %s\n", dump)
	}
	if hresp.StatusCode != 200 && hresp.StatusCode != 204 && hresp.StatusCode != 206 {
		return nil, buildError(hresp)
	}
	if resp != nil {
		err = xml.NewDecoder(hresp.Body).Decode(resp)
		hresp.Body.Close()

		if debug {
			log.Printf("goamz.s3> decoded xml into %#v", resp)
		}

	}
	return hresp, err
}

// run sends req and returns the http response from the server.
// If resp is not nil, the XML data contained in the response
// body will be unmarshalled on it.
func (s3 *S3) run(req *request, resp interface{}) (*http.Response, error) {
	if debug {
		log.Printf("Running S3 request: %#v", req)
	}

	hreq, err := s3.setupHttpRequest(req)
	if err != nil {
		return nil, err
	}

	return s3.doHttpRequest(hreq, resp)
}

// Error represents an error in an operation with S3.
type Error struct {
	StatusCode int    // HTTP status code (200, 403, ...)
	Code       string // EC2 error code ("UnsupportedOperation", ...)
	Message    string // The human-oriented error message
	BucketName string
	RequestId  string
	HostId     string
}

func (e *Error) Error() string {
	return e.Message
}

func buildError(r *http.Response) error {
	if debug {
		log.Printf("got error (status code %v)", r.StatusCode)
		data, err := ioutil.ReadAll(r.Body)
		if err != nil {
			log.Printf("\tread error: %v", err)
		} else {
			log.Printf("\tdata:\n%s\n\n", data)
		}
		r.Body = ioutil.NopCloser(bytes.NewBuffer(data))
	}

	err := Error{}
	// TODO return error if Unmarshal fails?
	xml.NewDecoder(r.Body).Decode(&err)
	r.Body.Close()
	err.StatusCode = r.StatusCode
	if err.Message == "" {
		err.Message = r.Status
	}
	if debug {
		log.Printf("err: %#v\n", err)
	}
	return &err
}

func shouldRetry(err error) bool {
	if err == nil {
		return false
	}
	switch err {
	case io.ErrUnexpectedEOF, io.EOF:
		return true
	}
	switch e := err.(type) {
	case *net.DNSError:
		return true
	case *net.OpError:
		switch e.Op {
		case "dial", "read", "write":
			return true
		}
	case *url.Error:
		// url.Error can be returned either by net/url if a URL cannot be
		// parsed, or by net/http if the response is closed before the headers
		// are received or parsed correctly. In that later case, e.Op is set to
		// the HTTP method name with the first letter uppercased. We don't want
		// to retry on POST operations, since those are not idempotent, all the
		// other ones should be safe to retry. The only case where all
		// operations are safe to retry are "dial" errors, since in that case
		// the POST request didn't make it to the server.

		if netErr, ok := e.Err.(*net.OpError); ok && netErr.Op == "dial" {
			return true
		}

		switch e.Op {
		case "Get", "Put", "Delete", "Head":
			return shouldRetry(e.Err)
		default:
			return false
		}
	case *Error:
		switch e.Code {
		case "InternalError", "NoSuchUpload", "NoSuchBucket":
			return true
		}
		switch e.StatusCode {
		case 500, 503, 504:
			return true
		}
	}
	return false
}

func hasCode(err error, code string) bool {
	s3err, ok := err.(*Error)
	return ok && s3err.Code == code
}

func escapePath(s string) string {
	return (&url.URL{Path: s}).String()
}
