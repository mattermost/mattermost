/*
 * MinIO Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2015-2017 MinIO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package minio

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"hash"
	"io"
	"io/ioutil"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	md5simd "github.com/minio/md5-simd"
	"github.com/minio/minio-go/v7/pkg/s3utils"
	"github.com/minio/sha256-simd"
)

func trimEtag(etag string) string {
	etag = strings.TrimPrefix(etag, "\"")
	return strings.TrimSuffix(etag, "\"")
}

var expirationRegex = regexp.MustCompile(`expiry-date="(.*?)", rule-id="(.*?)"`)

func amzExpirationToExpiryDateRuleID(expiration string) (time.Time, string) {
	if matches := expirationRegex.FindStringSubmatch(expiration); len(matches) == 3 {
		expTime, err := parseRFC7231Time(matches[1])
		if err != nil {
			return time.Time{}, ""
		}
		return expTime, matches[2]
	}
	return time.Time{}, ""
}

var restoreRegex = regexp.MustCompile(`ongoing-request="(.*?)"(, expiry-date="(.*?)")?`)

func amzRestoreToStruct(restore string) (ongoing bool, expTime time.Time, err error) {
	matches := restoreRegex.FindStringSubmatch(restore)
	if len(matches) != 4 {
		return false, time.Time{}, errors.New("unexpected restore header")
	}
	ongoing, err = strconv.ParseBool(matches[1])
	if err != nil {
		return false, time.Time{}, err
	}
	if matches[3] != "" {
		expTime, err = parseRFC7231Time(matches[3])
		if err != nil {
			return false, time.Time{}, err
		}
	}
	return
}

// xmlDecoder provide decoded value in xml.
func xmlDecoder(body io.Reader, v interface{}) error {
	d := xml.NewDecoder(body)
	return d.Decode(v)
}

// sum256 calculate sha256sum for an input byte array, returns hex encoded.
func sum256Hex(data []byte) string {
	hash := newSHA256Hasher()
	defer hash.Close()
	hash.Write(data)
	return hex.EncodeToString(hash.Sum(nil))
}

// sumMD5Base64 calculate md5sum for an input byte array, returns base64 encoded.
func sumMD5Base64(data []byte) string {
	hash := newMd5Hasher()
	defer hash.Close()
	hash.Write(data)
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

// getEndpointURL - construct a new endpoint.
func getEndpointURL(endpoint string, secure bool) (*url.URL, error) {
	if strings.Contains(endpoint, ":") {
		host, _, err := net.SplitHostPort(endpoint)
		if err != nil {
			return nil, err
		}
		if !s3utils.IsValidIP(host) && !s3utils.IsValidDomain(host) {
			msg := "Endpoint: " + endpoint + " does not follow ip address or domain name standards."
			return nil, errInvalidArgument(msg)
		}
	} else {
		if !s3utils.IsValidIP(endpoint) && !s3utils.IsValidDomain(endpoint) {
			msg := "Endpoint: " + endpoint + " does not follow ip address or domain name standards."
			return nil, errInvalidArgument(msg)
		}
	}
	// If secure is false, use 'http' scheme.
	scheme := "https"
	if !secure {
		scheme = "http"
	}

	// Construct a secured endpoint URL.
	endpointURLStr := scheme + "://" + endpoint
	endpointURL, err := url.Parse(endpointURLStr)
	if err != nil {
		return nil, err
	}

	// Validate incoming endpoint URL.
	if err := isValidEndpointURL(*endpointURL); err != nil {
		return nil, err
	}
	return endpointURL, nil
}

// closeResponse close non nil response with any response Body.
// convenient wrapper to drain any remaining data on response body.
//
// Subsequently this allows golang http RoundTripper
// to re-use the same connection for future requests.
func closeResponse(resp *http.Response) {
	// Callers should close resp.Body when done reading from it.
	// If resp.Body is not closed, the Client's underlying RoundTripper
	// (typically Transport) may not be able to re-use a persistent TCP
	// connection to the server for a subsequent "keep-alive" request.
	if resp != nil && resp.Body != nil {
		// Drain any remaining Body and then close the connection.
		// Without this closing connection would disallow re-using
		// the same connection for future uses.
		//  - http://stackoverflow.com/a/17961593/4465767
		io.Copy(ioutil.Discard, resp.Body)
		resp.Body.Close()
	}
}

var (
	// Hex encoded string of nil sha256sum bytes.
	emptySHA256Hex = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

	// Sentinel URL is the default url value which is invalid.
	sentinelURL = url.URL{}
)

// Verify if input endpoint URL is valid.
func isValidEndpointURL(endpointURL url.URL) error {
	if endpointURL == sentinelURL {
		return errInvalidArgument("Endpoint url cannot be empty.")
	}
	if endpointURL.Path != "/" && endpointURL.Path != "" {
		return errInvalidArgument("Endpoint url cannot have fully qualified paths.")
	}
	if strings.Contains(endpointURL.Host, ".s3.amazonaws.com") {
		if !s3utils.IsAmazonEndpoint(endpointURL) {
			return errInvalidArgument("Amazon S3 endpoint should be 's3.amazonaws.com'.")
		}
	}
	if strings.Contains(endpointURL.Host, ".googleapis.com") {
		if !s3utils.IsGoogleEndpoint(endpointURL) {
			return errInvalidArgument("Google Cloud Storage endpoint should be 'storage.googleapis.com'.")
		}
	}
	return nil
}

// Verify if input expires value is valid.
func isValidExpiry(expires time.Duration) error {
	expireSeconds := int64(expires / time.Second)
	if expireSeconds < 1 {
		return errInvalidArgument("Expires cannot be lesser than 1 second.")
	}
	if expireSeconds > 604800 {
		return errInvalidArgument("Expires cannot be greater than 7 days.")
	}
	return nil
}

// Extract only necessary metadata header key/values by
// filtering them out with a list of custom header keys.
func extractObjMetadata(header http.Header) http.Header {
	preserveKeys := []string{
		"Content-Type",
		"Cache-Control",
		"Content-Encoding",
		"Content-Language",
		"Content-Disposition",
		"X-Amz-Storage-Class",
		"X-Amz-Object-Lock-Mode",
		"X-Amz-Object-Lock-Retain-Until-Date",
		"X-Amz-Object-Lock-Legal-Hold",
		"X-Amz-Website-Redirect-Location",
		"X-Amz-Server-Side-Encryption",
		"X-Amz-Tagging-Count",
		"X-Amz-Meta-",
		// Add new headers to be preserved.
		// if you add new headers here, please extend
		// PutObjectOptions{} to preserve them
		// upon upload as well.
	}
	filteredHeader := make(http.Header)
	for k, v := range header {
		var found bool
		for _, prefix := range preserveKeys {
			if !strings.HasPrefix(k, prefix) {
				continue
			}
			found = true
			break
		}
		if found {
			filteredHeader[k] = v
		}
	}
	return filteredHeader
}

const (
	// RFC 7231#section-7.1.1.1 timetamp format. e.g Tue, 29 Apr 2014 18:30:38 GMT
	rfc822TimeFormat                           = "Mon, 2 Jan 2006 15:04:05 GMT"
	rfc822TimeFormatSingleDigitDay             = "Mon, _2 Jan 2006 15:04:05 GMT"
	rfc822TimeFormatSingleDigitDayTwoDigitYear = "Mon, _2 Jan 06 15:04:05 GMT"
)

func parseTime(t string, formats ...string) (time.Time, error) {
	for _, format := range formats {
		tt, err := time.Parse(format, t)
		if err == nil {
			return tt, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse %s in any of the input formats: %s", t, formats)
}

func parseRFC7231Time(lastModified string) (time.Time, error) {
	return parseTime(lastModified, rfc822TimeFormat, rfc822TimeFormatSingleDigitDay, rfc822TimeFormatSingleDigitDayTwoDigitYear)
}

// ToObjectInfo converts http header values into ObjectInfo type,
// extracts metadata and fills in all the necessary fields in ObjectInfo.
func ToObjectInfo(bucketName string, objectName string, h http.Header) (ObjectInfo, error) {
	var err error
	// Trim off the odd double quotes from ETag in the beginning and end.
	etag := trimEtag(h.Get("ETag"))

	// Parse content length is exists
	var size int64 = -1
	contentLengthStr := h.Get("Content-Length")
	if contentLengthStr != "" {
		size, err = strconv.ParseInt(contentLengthStr, 10, 64)
		if err != nil {
			// Content-Length is not valid
			return ObjectInfo{}, ErrorResponse{
				Code:       "InternalError",
				Message:    fmt.Sprintf("Content-Length is not an integer, failed with %v", err),
				BucketName: bucketName,
				Key:        objectName,
				RequestID:  h.Get("x-amz-request-id"),
				HostID:     h.Get("x-amz-id-2"),
				Region:     h.Get("x-amz-bucket-region"),
			}
		}
	}

	// Parse Last-Modified has http time format.
	mtime, err := parseRFC7231Time(h.Get("Last-Modified"))
	if err != nil {
		return ObjectInfo{}, ErrorResponse{
			Code:       "InternalError",
			Message:    fmt.Sprintf("Last-Modified time format is invalid, failed with %v", err),
			BucketName: bucketName,
			Key:        objectName,
			RequestID:  h.Get("x-amz-request-id"),
			HostID:     h.Get("x-amz-id-2"),
			Region:     h.Get("x-amz-bucket-region"),
		}
	}

	// Fetch content type if any present.
	contentType := strings.TrimSpace(h.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	expiryStr := h.Get("Expires")
	var expiry time.Time
	if expiryStr != "" {
		expiry, err = parseRFC7231Time(expiryStr)
		if err != nil {
			return ObjectInfo{}, ErrorResponse{
				Code:       "InternalError",
				Message:    fmt.Sprintf("'Expiry' is not in supported format: %v", err),
				BucketName: bucketName,
				Key:        objectName,
				RequestID:  h.Get("x-amz-request-id"),
				HostID:     h.Get("x-amz-id-2"),
				Region:     h.Get("x-amz-bucket-region"),
			}
		}
	}

	metadata := extractObjMetadata(h)
	userMetadata := make(map[string]string)
	for k, v := range metadata {
		if strings.HasPrefix(k, "X-Amz-Meta-") {
			userMetadata[strings.TrimPrefix(k, "X-Amz-Meta-")] = v[0]
		}
	}
	userTags := s3utils.TagDecode(h.Get(amzTaggingHeader))

	var tagCount int
	if count := h.Get(amzTaggingCount); count != "" {
		tagCount, err = strconv.Atoi(count)
		if err != nil {
			return ObjectInfo{}, ErrorResponse{
				Code:       "InternalError",
				Message:    fmt.Sprintf("x-amz-tagging-count is not an integer, failed with %v", err),
				BucketName: bucketName,
				Key:        objectName,
				RequestID:  h.Get("x-amz-request-id"),
				HostID:     h.Get("x-amz-id-2"),
				Region:     h.Get("x-amz-bucket-region"),
			}
		}
	}

	// Nil if not found
	var restore *RestoreInfo
	if restoreHdr := h.Get(amzRestore); restoreHdr != "" {
		ongoing, expTime, err := amzRestoreToStruct(restoreHdr)
		if err != nil {
			return ObjectInfo{}, err
		}
		restore = &RestoreInfo{OngoingRestore: ongoing, ExpiryTime: expTime}
	}

	// extract lifecycle expiry date and rule ID
	expTime, ruleID := amzExpirationToExpiryDateRuleID(h.Get(amzExpiration))

	deleteMarker := h.Get(amzDeleteMarker) == "true"

	// Save object metadata info.
	return ObjectInfo{
		ETag:              etag,
		Key:               objectName,
		Size:              size,
		LastModified:      mtime,
		ContentType:       contentType,
		Expires:           expiry,
		VersionID:         h.Get(amzVersionID),
		IsDeleteMarker:    deleteMarker,
		ReplicationStatus: h.Get(amzReplicationStatus),
		Expiration:        expTime,
		ExpirationRuleID:  ruleID,
		// Extract only the relevant header keys describing the object.
		// following function filters out a list of standard set of keys
		// which are not part of object metadata.
		Metadata:     metadata,
		UserMetadata: userMetadata,
		UserTags:     userTags,
		UserTagCount: tagCount,
		Restore:      restore,
	}, nil
}

var readFull = func(r io.Reader, buf []byte) (n int, err error) {
	// ReadFull reads exactly len(buf) bytes from r into buf.
	// It returns the number of bytes copied and an error if
	// fewer bytes were read. The error is EOF only if no bytes
	// were read. If an EOF happens after reading some but not
	// all the bytes, ReadFull returns ErrUnexpectedEOF.
	// On return, n == len(buf) if and only if err == nil.
	// If r returns an error having read at least len(buf) bytes,
	// the error is dropped.
	for n < len(buf) && err == nil {
		var nn int
		nn, err = r.Read(buf[n:])
		// Some spurious io.Reader's return
		// io.ErrUnexpectedEOF when nn == 0
		// this behavior is undocumented
		// so we are on purpose not using io.ReadFull
		// implementation because this can lead
		// to custom handling, to avoid that
		// we simply modify the original io.ReadFull
		// implementation to avoid this issue.
		// io.ErrUnexpectedEOF with nn == 0 really
		// means that io.EOF
		if err == io.ErrUnexpectedEOF && nn == 0 {
			err = io.EOF
		}
		n += nn
	}
	if n >= len(buf) {
		err = nil
	} else if n > 0 && err == io.EOF {
		err = io.ErrUnexpectedEOF
	}
	return
}

// regCred matches credential string in HTTP header
var regCred = regexp.MustCompile("Credential=([A-Z0-9]+)/")

// regCred matches signature string in HTTP header
var regSign = regexp.MustCompile("Signature=([[0-9a-f]+)")

// Redact out signature value from authorization string.
func redactSignature(origAuth string) string {
	if !strings.HasPrefix(origAuth, signV4Algorithm) {
		// Set a temporary redacted auth
		return "AWS **REDACTED**:**REDACTED**"
	}

	// Signature V4 authorization header.

	// Strip out accessKeyID from:
	// Credential=<access-key-id>/<date>/<aws-region>/<aws-service>/aws4_request
	newAuth := regCred.ReplaceAllString(origAuth, "Credential=**REDACTED**/")

	// Strip out 256-bit signature from: Signature=<256-bit signature>
	return regSign.ReplaceAllString(newAuth, "Signature=**REDACTED**")
}

// Get default location returns the location based on the input
// URL `u`, if region override is provided then all location
// defaults to regionOverride.
//
// If no other cases match then the location is set to `us-east-1`
// as a last resort.
func getDefaultLocation(u url.URL, regionOverride string) (location string) {
	if regionOverride != "" {
		return regionOverride
	}
	region := s3utils.GetRegionFromURL(u)
	if region == "" {
		region = "us-east-1"
	}
	return region
}

var supportedHeaders = map[string]bool{
	"content-type":                        true,
	"cache-control":                       true,
	"content-encoding":                    true,
	"content-disposition":                 true,
	"content-language":                    true,
	"x-amz-website-redirect-location":     true,
	"x-amz-object-lock-mode":              true,
	"x-amz-metadata-directive":            true,
	"x-amz-object-lock-retain-until-date": true,
	"expires":                             true,
	"x-amz-replication-status":            true,
	// Add more supported headers here.
	// Must be lower case.
}

// isStorageClassHeader returns true if the header is a supported storage class header
func isStorageClassHeader(headerKey string) bool {
	return strings.EqualFold(amzStorageClass, headerKey)
}

// isStandardHeader returns true if header is a supported header and not a custom header
func isStandardHeader(headerKey string) bool {
	return supportedHeaders[strings.ToLower(headerKey)]
}

// sseHeaders is list of server side encryption headers
var sseHeaders = map[string]bool{
	"x-amz-server-side-encryption":                    true,
	"x-amz-server-side-encryption-aws-kms-key-id":     true,
	"x-amz-server-side-encryption-context":            true,
	"x-amz-server-side-encryption-customer-algorithm": true,
	"x-amz-server-side-encryption-customer-key":       true,
	"x-amz-server-side-encryption-customer-key-md5":   true,
	// Add more supported headers here.
	// Must be lower case.
}

// isSSEHeader returns true if header is a server side encryption header.
func isSSEHeader(headerKey string) bool {
	return sseHeaders[strings.ToLower(headerKey)]
}

// isAmzHeader returns true if header is a x-amz-meta-* or x-amz-acl header.
func isAmzHeader(headerKey string) bool {
	key := strings.ToLower(headerKey)

	return strings.HasPrefix(key, "x-amz-meta-") || strings.HasPrefix(key, "x-amz-grant-") || key == "x-amz-acl" || isSSEHeader(headerKey)
}

var md5Pool = sync.Pool{New: func() interface{} { return md5.New() }}
var sha256Pool = sync.Pool{New: func() interface{} { return sha256.New() }}

func newMd5Hasher() md5simd.Hasher {
	return hashWrapper{Hash: md5Pool.New().(hash.Hash), isMD5: true}
}

func newSHA256Hasher() md5simd.Hasher {
	return hashWrapper{Hash: sha256Pool.New().(hash.Hash), isSHA256: true}
}

// hashWrapper implements the md5simd.Hasher interface.
type hashWrapper struct {
	hash.Hash
	isMD5    bool
	isSHA256 bool
}

// Close will put the hasher back into the pool.
func (m hashWrapper) Close() {
	if m.isMD5 && m.Hash != nil {
		m.Reset()
		md5Pool.Put(m.Hash)
	}
	if m.isSHA256 && m.Hash != nil {
		m.Reset()
		sha256Pool.Put(m.Hash)
	}
	m.Hash = nil
}

const letterBytes = "abcdefghijklmnopqrstuvwxyz01234569"
const (
	letterIdxBits = 6                    // 6 bits to represent a letter index
	letterIdxMask = 1<<letterIdxBits - 1 // All 1-bits, as many as letterIdxBits
	letterIdxMax  = 63 / letterIdxBits   // # of letter indices fitting in 63 bits
)

// randString generates random names and prepends them with a known prefix.
func randString(n int, src rand.Source, prefix string) string {
	b := make([]byte, n)
	// A rand.Int63() generates 63 random bits, enough for letterIdxMax letters!
	for i, cache, remain := n-1, src.Int63(), letterIdxMax; i >= 0; {
		if remain == 0 {
			cache, remain = src.Int63(), letterIdxMax
		}
		if idx := int(cache & letterIdxMask); idx < len(letterBytes) {
			b[i] = letterBytes[idx]
			i--
		}
		cache >>= letterIdxBits
		remain--
	}
	return prefix + string(b[0:30-len(prefix)])
}

// IsNetworkOrHostDown - if there was a network error or if the host is down.
// expectTimeouts indicates that *context* timeouts are expected and does not
// indicate a downed host. Other timeouts still returns down.
func IsNetworkOrHostDown(err error, expectTimeouts bool) bool {
	if err == nil {
		return false
	}

	if errors.Is(err, context.Canceled) {
		return false
	}

	if expectTimeouts && errors.Is(err, context.DeadlineExceeded) {
		return false
	}

	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	// We need to figure if the error either a timeout
	// or a non-temporary error.
	urlErr := &url.Error{}
	if errors.As(err, &urlErr) {
		switch urlErr.Err.(type) {
		case *net.DNSError, *net.OpError, net.UnknownNetworkError:
			return true
		}
	}
	var e net.Error
	if errors.As(err, &e) {
		if e.Timeout() {
			return true
		}
	}

	// Fallback to other mechanisms.
	switch {
	case strings.Contains(err.Error(), "Connection closed by foreign host"):
		return true
	case strings.Contains(err.Error(), "TLS handshake timeout"):
		// If error is - tlsHandshakeTimeoutError.
		return true
	case strings.Contains(err.Error(), "i/o timeout"):
		// If error is - tcp timeoutError.
		return true
	case strings.Contains(err.Error(), "connection timed out"):
		// If err is a net.Dial timeout.
		return true
	case strings.Contains(err.Error(), "connection refused"):
		// If err is connection refused
		return true

	case strings.Contains(strings.ToLower(err.Error()), "503 service unavailable"):
		// Denial errors
		return true
	}
	return false
}
