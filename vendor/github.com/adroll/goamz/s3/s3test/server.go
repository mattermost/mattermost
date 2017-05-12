package s3test

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"github.com/AdRoll/goamz/s3"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const debug = false

var rangePattern = regexp.MustCompile(`^bytes=([\d]*)-([\d]*)$`)

type s3Error struct {
	statusCode int
	XMLName    struct{} `xml:"Error"`
	Code       string
	Message    string
	BucketName string
	RequestId  string
	HostId     string
}

type action struct {
	srv   *Server
	w     http.ResponseWriter
	req   *http.Request
	reqId string
}

// A Clock reports the current time.
type Clock interface {
	Now() time.Time
}

type realClock struct{}

func (c *realClock) Now() time.Time {
	return time.Now()
}

// Config controls the internal behaviour of the Server. A nil config is the default
// and behaves as if all configurations assume their default behaviour. Once passed
// to NewServer, the configuration must not be modified.
type Config struct {
	// Send409Conflict controls how the Server will respond to calls to PUT on a
	// previously existing bucket. The default is false, and corresponds to the
	// us-east-1 s3 enpoint. Setting this value to true emulates the behaviour of
	// all other regions.
	// http://docs.amazonwebservices.com/AmazonS3/latest/API/ErrorResponses.html
	Send409Conflict bool

	// Address on which to listen. By default, a random port is assigned by the
	// operating system and the server listens on localhost.
	ListenAddress string

	// Clock used to set mtime when updating an object. If nil,
	// use the real clock.
	Clock Clock
}

func (c *Config) send409Conflict() bool {
	if c != nil {
		return c.Send409Conflict
	}
	return false
}

// Server is a fake S3 server for testing purposes.
// All of the data for the server is kept in memory.
type Server struct {
	url      string
	reqId    int
	listener net.Listener
	mu       sync.Mutex
	buckets  map[string]*bucket
	config   *Config
	closed   bool
}

type bucket struct {
	name             string
	acl              s3.ACL
	ctime            time.Time
	objects          map[string]*object
	multipartUploads map[string][]*multipartUploadPart
	multipartMeta    map[string]http.Header
}

type object struct {
	name     string
	mtime    time.Time
	meta     http.Header // metadata to return with requests.
	checksum []byte      // also held as Content-MD5 in meta.
	data     []byte
}

type multipartUploadPart struct {
	index        uint
	data         []byte
	etag         string
	lastModified time.Time
}

type multipartUploadPartByIndex []*multipartUploadPart

func (x multipartUploadPartByIndex) Len() int {
	return len(x)
}

func (x multipartUploadPartByIndex) Swap(i, j int) {
	x[i], x[j] = x[j], x[i]
}

func (x multipartUploadPartByIndex) Less(i, j int) bool {
	return x[i].index < x[j].index
}

// A resource encapsulates the subject of an HTTP request.
// The resource referred to may or may not exist
// when the request is made.
type resource interface {
	put(a *action) interface{}
	get(a *action) interface{}
	post(a *action) interface{}
	delete(a *action) interface{}
}

func NewServer(config *Config) (*Server, error) {
	listenAddress := "localhost:0"

	if config == nil {
		config = &Config{}
	}

	if config.ListenAddress != "" {
		listenAddress = config.ListenAddress
	}

	if config.Clock == nil {
		config.Clock = &realClock{}
	}

	l, err := net.Listen("tcp", listenAddress)
	if err != nil {
		return nil, fmt.Errorf("cannot listen on localhost: %v", err)
	}
	srv := &Server{
		listener: l,
		url:      "http://" + l.Addr().String(),
		buckets:  make(map[string]*bucket),
		config:   config,
	}
	go http.Serve(l, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		srv.serveHTTP(w, req)
	}))
	return srv, nil
}

// Quit closes down the server.
func (srv *Server) Quit() {
	srv.mu.Lock()
	srv.closed = true
	srv.mu.Unlock()

	srv.listener.Close()
}

// URL returns a URL for the server.
func (srv *Server) URL() string {
	return srv.url
}

func fatalf(code int, codeStr string, errf string, a ...interface{}) {
	panic(&s3Error{
		statusCode: code,
		Code:       codeStr,
		Message:    fmt.Sprintf(errf, a...),
	})
}

// serveHTTP serves the S3 protocol.
func (srv *Server) serveHTTP(w http.ResponseWriter, req *http.Request) {
	// ignore error from ParseForm as it's usually spurious.
	req.ParseForm()

	srv.mu.Lock()
	defer srv.mu.Unlock()

	if srv.closed {
		hj := w.(http.Hijacker)
		conn, _, _ := hj.Hijack()
		conn.Close()
		return
	}

	if debug {
		log.Printf("s3test %q %q", req.Method, req.URL)
	}
	a := &action{
		srv:   srv,
		w:     w,
		req:   req,
		reqId: fmt.Sprintf("%09X", srv.reqId),
	}
	srv.reqId++

	var r resource
	defer func() {
		switch err := recover().(type) {
		case *s3Error:
			switch r := r.(type) {
			case objectResource:
				err.BucketName = r.bucket.name
			case bucketResource:
				err.BucketName = r.name
			}
			err.RequestId = a.reqId
			// TODO HostId
			w.Header().Set("Content-Type", `xml version="1.0" encoding="UTF-8"`)
			w.WriteHeader(err.statusCode)
			xmlMarshal(w, err)
		case nil:
		default:
			panic(err)
		}
	}()

	r = srv.resourceForURL(req.URL)

	var resp interface{}
	switch req.Method {
	case "PUT":
		resp = r.put(a)
	case "GET", "HEAD":
		resp = r.get(a)
	case "DELETE":
		resp = r.delete(a)
	case "POST":
		resp = r.post(a)
	default:
		fatalf(400, "MethodNotAllowed", "unknown http request method %q", req.Method)
	}
	if resp != nil && req.Method != "HEAD" {
		xmlMarshal(w, resp)
	}
}

// xmlMarshal is the same as xml.Marshal except that
// it panics on error. The marshalling should not fail,
// but we want to know if it does.
func xmlMarshal(w io.Writer, x interface{}) {
	if err := xml.NewEncoder(w).Encode(x); err != nil {
		panic(fmt.Errorf("error marshalling %#v: %v", x, err))
	}
}

// In a fully implemented test server, each of these would have
// its own resource type.
var unimplementedBucketResourceNames = map[string]bool{
	"acl":            true,
	"lifecycle":      true,
	"policy":         true,
	"location":       true,
	"logging":        true,
	"notification":   true,
	"versions":       true,
	"requestPayment": true,
	"versioning":     true,
	"website":        true,
	"uploads":        true,
}

var unimplementedObjectResourceNames = map[string]bool{
	"acl":     true,
	"torrent": true,
}

var pathRegexp = regexp.MustCompile("/(([^/]+)(/(.*))?)?")

// resourceForURL returns a resource object for the given URL.
func (srv *Server) resourceForURL(u *url.URL) (r resource) {
	m := pathRegexp.FindStringSubmatch(u.Path)
	if m == nil {
		fatalf(404, "InvalidURI", "Couldn't parse the specified URI")
	}
	bucketName := m[2]
	objectName := m[4]
	if bucketName == "" {
		return nullResource{} // root
	}
	b := bucketResource{
		name:   bucketName,
		bucket: srv.buckets[bucketName],
	}
	q := u.Query()
	if objectName == "" {
		for name := range q {
			if unimplementedBucketResourceNames[name] {
				return nullResource{}
			}
		}
		return b

	}
	if b.bucket == nil {
		fatalf(404, "NoSuchBucket", "The specified bucket does not exist")
	}
	objr := objectResource{
		name:    objectName,
		version: q.Get("versionId"),
		bucket:  b.bucket,
	}
	for name := range q {
		if unimplementedObjectResourceNames[name] {
			return nullResource{}
		}
	}
	if obj := objr.bucket.objects[objr.name]; obj != nil {
		objr.object = obj
	}
	return objr
}

// nullResource has error stubs for all resource methods.
type nullResource struct{}

func notAllowed() interface{} {
	fatalf(400, "MethodNotAllowed", "The specified method is not allowed against this resource")
	return nil
}

func (nullResource) put(a *action) interface{}    { return notAllowed() }
func (nullResource) get(a *action) interface{}    { return notAllowed() }
func (nullResource) post(a *action) interface{}   { return notAllowed() }
func (nullResource) delete(a *action) interface{} { return notAllowed() }

const timeFormat = "2006-01-02T15:04:05.000Z"
const lastModifiedTimeFormat = "Mon, 2 Jan 2006 15:04:05 GMT"

type bucketResource struct {
	name   string
	bucket *bucket // non-nil if the bucket already exists.
}

// GET on a bucket lists the objects in the bucket.
// http://docs.amazonwebservices.com/AmazonS3/latest/API/RESTBucketGET.html
func (r bucketResource) get(a *action) interface{} {
	if r.bucket == nil {
		fatalf(404, "NoSuchBucket", "The specified bucket does not exist")
	}
	delimiter := a.req.Form.Get("delimiter")
	marker := a.req.Form.Get("marker")
	maxKeys := -1
	if s := a.req.Form.Get("max-keys"); s != "" {
		i, err := strconv.Atoi(s)
		if err != nil || i < 0 {
			fatalf(400, "invalid value for max-keys: %q", s)
		}
		maxKeys = i
	}
	prefix := a.req.Form.Get("prefix")
	a.w.Header().Set("Content-Type", "application/xml")

	if a.req.Method == "HEAD" {
		return nil
	}

	var objs orderedObjects

	// first get all matching objects and arrange them in alphabetical order.
	for name, obj := range r.bucket.objects {
		if strings.HasPrefix(name, prefix) {
			objs = append(objs, obj)
		}
	}
	sort.Sort(objs)

	if maxKeys <= 0 {
		maxKeys = 1000
	}

	type commonPrefix struct {
		Prefix string
	}

	type serverListResponse struct {
		s3.ListResp
		CommonPrefixes []commonPrefix
	}

	resp := &serverListResponse{
		ListResp: s3.ListResp{
			Name:      r.bucket.name,
			Prefix:    prefix,
			Delimiter: delimiter,
			Marker:    marker,
			MaxKeys:   maxKeys,
		},
	}

	var prefixes []commonPrefix
	var lastName string
	for _, obj := range objs {
		if !strings.HasPrefix(obj.name, prefix) {
			continue
		}
		name := obj.name
		isPrefix := false
		if delimiter != "" {
			if i := strings.Index(obj.name[len(prefix):], delimiter); i >= 0 {
				name = obj.name[:len(prefix)+i+len(delimiter)]
				if prefixes != nil && prefixes[len(prefixes)-1].Prefix == name {
					continue
				}
				isPrefix = true
			}
		}
		if name <= marker {
			continue
		}
		if len(resp.Contents)+len(prefixes) >= maxKeys {
			resp.IsTruncated = true
			resp.NextMarker = lastName
			break
		}
		if isPrefix {
			prefixes = append(prefixes, commonPrefix{Prefix: name})
		} else {
			// Contents contains only keys not found in CommonPrefixes
			resp.Contents = append(resp.Contents, obj.s3Key())
		}
		lastName = name
	}
	resp.CommonPrefixes = prefixes
	return resp
}

// orderedObjects holds a slice of objects that can be sorted
// by name.
type orderedObjects []*object

func (s orderedObjects) Len() int {
	return len(s)
}
func (s orderedObjects) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
func (s orderedObjects) Less(i, j int) bool {
	return s[i].name < s[j].name
}

func (obj *object) s3Key() s3.Key {
	return s3.Key{
		Key:          obj.name,
		LastModified: obj.mtime.UTC().Format(timeFormat),
		Size:         int64(len(obj.data)),
		ETag:         fmt.Sprintf(`"%x"`, obj.checksum),
		// TODO StorageClass
		// TODO Owner
	}
}

// DELETE on a bucket deletes the bucket if it's not empty.
func (r bucketResource) delete(a *action) interface{} {
	b := r.bucket
	if b == nil {
		fatalf(404, "NoSuchBucket", "The specified bucket does not exist")
	}
	if len(b.objects) > 0 {
		fatalf(400, "BucketNotEmpty", "The bucket you tried to delete is not empty")
	}
	delete(a.srv.buckets, b.name)
	return nil
}

// PUT on a bucket creates the bucket.
// http://docs.amazonwebservices.com/AmazonS3/latest/API/RESTBucketPUT.html
func (r bucketResource) put(a *action) interface{} {
	var created bool
	if r.bucket == nil {
		if !validBucketName(r.name) {
			fatalf(400, "InvalidBucketName", "The specified bucket is not valid")
		}
		if loc := locationConstraint(a); loc == "" {
			fatalf(400, "InvalidRequets", "The unspecified location constraint is incompatible for the region specific endpoint this request was sent to.")
		}
		// TODO validate acl
		r.bucket = &bucket{
			name: r.name,
			// TODO default acl
			objects:          make(map[string]*object),
			multipartUploads: make(map[string][]*multipartUploadPart),
			multipartMeta:    make(map[string]http.Header),
		}
		a.srv.buckets[r.name] = r.bucket
		created = true
	}
	if !created && a.srv.config.send409Conflict() {
		fatalf(409, "BucketAlreadyOwnedByYou", "Your previous request to create the named bucket succeeded and you already own it.")
	}
	r.bucket.acl = s3.ACL(a.req.Header.Get("x-amz-acl"))
	return nil
}

func (r bucketResource) post(a *action) interface{} {
	if _, multiDel := a.req.URL.Query()["delete"]; multiDel {
		return r.multiDel(a)
	}

	fatalf(400, "Method", "bucket operation not supported")
	return nil
}

func (b bucketResource) multiDel(a *action) interface{} {
	type multiDelRequestObject struct {
		Key       string
		VersionId string
	}

	type multiDelRequest struct {
		Quiet  bool
		Object []*multiDelRequestObject
	}

	type multiDelDelete struct {
		XMLName struct{} `xml:"Deleted"`
		Key     string
	}

	type multiDelError struct {
		XMLName struct{} `xml:"Error"`
		Key     string
		Code    string
		Message string
	}

	type multiDelResult struct {
		XMLName struct{} `xml:"DeleteResult"`
		Deleted []*multiDelDelete
		Error   []*multiDelError
	}

	req := &multiDelRequest{}

	if err := xml.NewDecoder(a.req.Body).Decode(req); err != nil {
		fatalf(400, "InvalidRequest", err.Error())
	}

	res := &multiDelResult{
		Deleted: []*multiDelDelete{},
		Error:   []*multiDelError{},
	}

	for _, o := range req.Object {
		if _, exists := b.bucket.objects[o.Key]; exists {
			delete(b.bucket.objects, o.Key)

			res.Deleted = append(res.Deleted, &multiDelDelete{
				Key: o.Key,
			})
		} else {
			res.Error = append(res.Error, &multiDelError{
				Key:     o.Key,
				Code:    "AccessDenied",
				Message: "Access Denied",
			})
		}
	}

	return res
}

// validBucketName returns whether name is a valid bucket name.
// Here are the rules, from:
// http://docs.amazonwebservices.com/AmazonS3/2006-03-01/dev/BucketRestrictions.html
//
// Can contain lowercase letters, numbers, periods (.), underscores (_),
// and dashes (-). You can use uppercase letters for buckets only in the
// US Standard region.
//
// Must start with a number or letter
//
// Must be between 3 and 255 characters long
//
// There's one extra rule (Must not be formatted as an IP address (e.g., 192.168.5.4)
// but the real S3 server does not seem to check that rule, so we will not
// check it either.
//
func validBucketName(name string) bool {
	if len(name) < 3 || len(name) > 255 {
		return false
	}
	r := name[0]
	if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'z') {
		return false
	}
	for _, r := range name {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'z':
		case r == '_' || r == '-':
		case r == '.':
		default:
			return false
		}
	}
	return true
}

var responseParams = map[string]bool{
	"content-type":        true,
	"content-language":    true,
	"expires":             true,
	"cache-control":       true,
	"content-disposition": true,
	"content-encoding":    true,
}

type objectResource struct {
	name    string
	version string
	bucket  *bucket // always non-nil.
	object  *object // may be nil.
}

// GET on an object gets the contents of the object.
// http://docs.amazonwebservices.com/AmazonS3/latest/API/RESTObjectGET.html
func (objr objectResource) get(a *action) interface{} {
	obj := objr.object
	if obj == nil {
		fatalf(404, "NoSuchKey", "The specified key does not exist.")
	}
	h := a.w.Header()
	// add metadata
	for name, d := range obj.meta {
		h[name] = d
	}
	// override header values in response to request parameters.
	for name, vals := range a.req.Form {
		if strings.HasPrefix(name, "response-") {
			name = name[len("response-"):]
			if !responseParams[name] {
				continue
			}
			h.Set(name, vals[0])
		}
	}

	data := obj.data
	status := http.StatusOK
	if r := a.req.Header.Get("Range"); r != "" {
		// s3 ignores invalid ranges
		if matches := rangePattern.FindStringSubmatch(r); len(matches) == 3 {
			var err error
			start := 0
			end := len(obj.data) - 1
			if matches[1] != "" {
				start, err = strconv.Atoi(matches[1])
			}
			if err == nil && matches[2] != "" {
				end, err = strconv.Atoi(matches[2])
			}
			if err == nil && start >= 0 && end >= start {
				if start >= len(obj.data) {
					fatalf(416, "InvalidRequest", "The requested range is not satisfiable")
				}
				if end > len(obj.data)-1 {
					end = len(obj.data) - 1
				}
				data = obj.data[start : end+1]
				status = http.StatusPartialContent
				h.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, len(obj.data)))
			}
		}
	}
	// TODO Last-Modified-Since
	// TODO If-Modified-Since
	// TODO If-Unmodified-Since
	// TODO If-Match
	// TODO If-None-Match
	// TODO Connection: close ??
	// TODO x-amz-request-id
	h.Set("Content-Length", fmt.Sprint(len(data)))
	h.Set("ETag", "\""+hex.EncodeToString(obj.checksum)+"\"")
	h.Set("Last-Modified", obj.mtime.UTC().Format(lastModifiedTimeFormat))

	if status != http.StatusOK {
		a.w.WriteHeader(status)
	}

	if a.req.Method == "HEAD" {
		return nil
	}
	// TODO avoid holding the lock when writing data.
	_, err := a.w.Write(data)
	if err != nil {
		// we can't do much except just log the fact.
		log.Printf("error writing data: %v", err)
	}
	return nil
}

var metaHeaders = map[string]bool{
	"Content-MD5":         true,
	"x-amz-acl":           true,
	"Content-Type":        true,
	"Content-Encoding":    true,
	"Content-Disposition": true,
}

// PUT on an object creates the object.
func (objr objectResource) put(a *action) interface{} {
	// TODO Cache-Control header
	// TODO Expires header
	// TODO x-amz-server-side-encryption
	// TODO x-amz-storage-class

	var res interface{}

	uploadId := a.req.URL.Query().Get("uploadId")
	var partNumber uint

	// Check that the upload ID is valid if this is a multipart upload
	if uploadId != "" {
		if _, ok := objr.bucket.multipartUploads[uploadId]; !ok {
			fatalf(404, "NoSuchUpload", "The specified multipart upload does not exist. The upload ID might be invalid, or the multipart upload might have been aborted or completed.")
		}

		partNumberStr := a.req.URL.Query().Get("partNumber")

		if partNumberStr == "" {
			fatalf(400, "InvalidRequest", "Missing partNumber parameter")
		}

		number, err := strconv.ParseUint(partNumberStr, 10, 32)

		if err != nil {
			fatalf(400, "InvalidRequest", "partNumber is not a number")
		}

		partNumber = uint(number)
	}

	var expectHash []byte
	if c := a.req.Header.Get("Content-MD5"); c != "" {
		var err error
		expectHash, err = base64.StdEncoding.DecodeString(c)
		if err != nil || len(expectHash) != md5.Size {
			fatalf(400, "InvalidDigest", "The Content-MD5 you specified was invalid")
		}
	}
	sum := md5.New()
	// TODO avoid holding lock while reading data.
	data, err := ioutil.ReadAll(io.TeeReader(a.req.Body, sum))
	if err != nil {
		fatalf(400, "TODO", "read error")
	}
	gotHash := sum.Sum(nil)
	if expectHash != nil && bytes.Compare(gotHash, expectHash) != 0 {
		fatalf(400, "BadDigest", "The Content-MD5 you specified did not match what we received")
	}
	if a.req.ContentLength >= 0 && int64(len(data)) != a.req.ContentLength {
		fatalf(400, "IncompleteBody", "You did not provide the number of bytes specified by the Content-Length HTTP header")
	}

	etag := fmt.Sprintf("\"%x\"", gotHash)

	a.w.Header().Add("ETag", etag)

	if uploadId == "" {
		// For traditional uploads

		// TODO is this correct, or should we erase all previous metadata?
		obj := objr.object
		if obj == nil {
			obj = &object{
				name: objr.name,
				meta: make(http.Header),
			}
		}

		// PUT request has been successful - save data and metadata
		for key, values := range a.req.Header {
			key = http.CanonicalHeaderKey(key)
			if metaHeaders[key] || strings.HasPrefix(key, "X-Amz-Meta-") {
				obj.meta[key] = values
			}
		}
		obj.mtime = a.srv.config.Clock.Now()

		if copySource := a.req.Header.Get("X-Amz-Copy-Source"); copySource != "" {
			idx := strings.IndexByte(copySource, '/')

			if idx == -1 {
				fatalf(400, "InvalidRequest", "Wrongly formatted X-Amz-Copy-Source")
			}

			sourceBucketName := copySource[0:idx]
			sourceKey := copySource[1+idx:]

			sourceBucket := a.srv.buckets[sourceBucketName]

			if sourceBucket == nil {
				fatalf(404, "NoSuchBucket", "The specified source bucket does not exist")
			}

			sourceObject := sourceBucket.objects[sourceKey]

			if sourceObject == nil {
				fatalf(404, "NoSuchKey", "The specified source key does not exist")
			}

			if obj != sourceObject {
				obj.data = make([]byte, len(sourceObject.data))
				copy(obj.data, sourceObject.data)

				obj.checksum = make([]byte, len(sourceObject.checksum))
				copy(obj.checksum, sourceObject.checksum)

				obj.meta = make(http.Header, len(sourceObject.meta))

				for k, v := range sourceObject.meta {
					obj.meta[k] = make([]string, len(v))
					copy(obj.meta[k], v)
				}
			}

			res = &s3.CopyObjectResult{
				ETag:         etag,
				LastModified: obj.mtime.UTC().Format(time.RFC3339),
			}
		} else {
			obj.data = data
			obj.checksum = gotHash
		}
		objr.bucket.objects[objr.name] = obj
	} else {
		// For multipart commit

		parts := objr.bucket.multipartUploads[uploadId]
		part := &multipartUploadPart{
			index:        partNumber,
			data:         data,
			etag:         etag,
			lastModified: a.srv.config.Clock.Now(),
		}

		objr.bucket.multipartUploads[uploadId] = append(parts, part)
	}

	return res
}

func (objr objectResource) delete(a *action) interface{} {
	uploadId := a.req.URL.Query().Get("uploadId")

	if uploadId == "" {
		// Traditional object delete
		delete(objr.bucket.objects, objr.name)
	} else {
		// Multipart commit abort
		_, ok := objr.bucket.multipartUploads[uploadId]

		if !ok {
			fatalf(404, "NoSuchUpload", "The specified multipart upload does not exist. The upload ID might be invalid, or the multipart upload might have been aborted or completed.")
		}

		delete(objr.bucket.multipartUploads, uploadId)
	}
	return nil
}

func (objr objectResource) post(a *action) interface{} {
	// Check if we're initializing a multipart upload
	if _, ok := a.req.URL.Query()["uploads"]; ok {
		type multipartInitResponse struct {
			XMLName  struct{} `xml:"InitiateMultipartUploadResult"`
			Bucket   string
			Key      string
			UploadId string
		}

		uploadId := strconv.FormatInt(rand.Int63(), 16)

		objr.bucket.multipartUploads[uploadId] = []*multipartUploadPart{}
		objr.bucket.multipartMeta[uploadId] = make(http.Header)
		for key, values := range a.req.Header {
			key = http.CanonicalHeaderKey(key)
			if metaHeaders[key] || strings.HasPrefix(key, "X-Amz-Meta-") {
				objr.bucket.multipartMeta[uploadId][key] = values
			}
		}

		return &multipartInitResponse{
			Bucket:   objr.bucket.name,
			Key:      objr.name,
			UploadId: uploadId,
		}
	}

	// Check if we're completing a multipart upload
	if uploadId := a.req.URL.Query().Get("uploadId"); uploadId != "" {
		type multipartCompleteRequestPart struct {
			XMLName    struct{} `xml:"Part"`
			PartNumber uint
			ETag       string
		}

		type multipartCompleteRequest struct {
			XMLName struct{} `xml:"CompleteMultipartUpload"`
			Part    []multipartCompleteRequestPart
		}

		type multipartCompleteResponse struct {
			XMLName  struct{} `xml:"CompleteMultipartUploadResult"`
			Location string
			Bucket   string
			Key      string
			ETag     string
		}

		parts, ok := objr.bucket.multipartUploads[uploadId]

		if !ok {
			fatalf(404, "NoSuchUpload", "The specified multipart upload does not exist. The upload ID might be invalid, or the multipart upload might have been aborted or completed.")
		}

		req := &multipartCompleteRequest{}

		if err := xml.NewDecoder(a.req.Body).Decode(req); err != nil {
			fatalf(400, "InvalidRequest", err.Error())
		}

		if len(req.Part) != len(parts) {
			fatalf(400, "InvalidRequest", fmt.Sprintf("Number of parts does not match: expected %d, received %d", len(parts), len(req.Part)))
		}

		sum := md5.New()
		data := &bytes.Buffer{}
		w := io.MultiWriter(sum, data)

		sort.Sort(multipartUploadPartByIndex(parts))

		for i, p := range parts {
			reqPart := req.Part[i]

			if reqPart.PartNumber != p.index {
				fatalf(400, "InvalidRequest", "Bad part number")
			}

			if reqPart.ETag != p.etag {
				fatalf(400, "InvalidRequest", fmt.Sprintf("Invalid etag for part %d", reqPart.PartNumber))
			}

			w.Write(p.data)
		}

		delete(objr.bucket.multipartUploads, uploadId)

		obj := objr.object

		if obj == nil {
			obj = &object{
				name: objr.name,
				meta: make(http.Header),
			}
		}

		obj.data = data.Bytes()
		obj.checksum = sum.Sum(nil)
		obj.mtime = time.Now()
		objr.bucket.objects[objr.name] = obj
		obj.meta = objr.bucket.multipartMeta[uploadId]

		objectLocation := fmt.Sprintf("http://%s/%s/%s", a.srv.listener.Addr().String(), objr.bucket.name, objr.name)

		return &multipartCompleteResponse{
			Location: objectLocation,
			Bucket:   objr.bucket.name,
			Key:      objr.name,
			ETag:     uploadId,
		}
	}

	fatalf(400, "MethodNotAllowed", "The specified method is not allowed against this resource")
	return nil
}

type CreateBucketConfiguration struct {
	LocationConstraint string
}

// locationConstraint parses the <CreateBucketConfiguration /> request body (if present).
// If there is no body, an empty string will be returned.
func locationConstraint(a *action) string {
	var body bytes.Buffer
	if _, err := io.Copy(&body, a.req.Body); err != nil {
		fatalf(400, "InvalidRequest", err.Error())
	}
	if body.Len() == 0 {
		return ""
	}
	var loc CreateBucketConfiguration
	if err := xml.NewDecoder(&body).Decode(&loc); err != nil {
		fatalf(400, "InvalidRequest", err.Error())
	}
	return loc.LocationConstraint
}
