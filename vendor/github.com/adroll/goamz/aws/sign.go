package aws

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"
)

// AWS specifies that the parameters in a signed request must
// be provided in the natural order of the keys. This is distinct
// from the natural order of the encoded value of key=value.
// Percent and gocheck.Equals affect the sorting order.
func EncodeSorted(values url.Values) string {
	// preallocate the arrays for perfomance
	keys := make([]string, 0, len(values))
	sarray := make([]string, 0, len(values))
	for k, _ := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		for _, v := range values[k] {
			sarray = append(sarray, Encode(k)+"="+Encode(v))
		}
	}

	return strings.Join(sarray, "&")
}

type V2Signer struct {
	auth    Auth
	service ServiceInfo
	host    string
}

var b64 = base64.StdEncoding

func NewV2Signer(auth Auth, service ServiceInfo) (*V2Signer, error) {
	u, err := url.Parse(service.Endpoint)
	if err != nil {
		return nil, err
	}
	return &V2Signer{auth: auth, service: service, host: u.Host}, nil
}

func (s *V2Signer) Sign(method, path string, params map[string]string) {
	params["AWSAccessKeyId"] = s.auth.AccessKey
	params["SignatureVersion"] = "2"
	params["SignatureMethod"] = "HmacSHA256"
	if s.auth.Token() != "" {
		params["SecurityToken"] = s.auth.Token()
	}
	// AWS specifies that the parameters in a signed request must
	// be provided in the natural order of the keys. This is distinct
	// from the natural order of the encoded value of key=value.
	// Percent and gocheck.Equals affect the sorting order.
	var keys, sarray []string
	for k, _ := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		sarray = append(sarray, Encode(k)+"="+Encode(params[k]))
	}
	joined := strings.Join(sarray, "&")
	payload := method + "\n" + s.host + "\n" + path + "\n" + joined
	hash := hmac.New(sha256.New, []byte(s.auth.SecretKey))
	hash.Write([]byte(payload))
	signature := make([]byte, b64.EncodedLen(hash.Size()))
	b64.Encode(signature, hash.Sum(nil))

	params["Signature"] = string(signature)
}

func (s *V2Signer) SignRequest(req *http.Request) error {
	req.ParseForm()
	req.Form.Set("AWSAccessKeyId", s.auth.AccessKey)
	req.Form.Set("SignatureVersion", "2")
	req.Form.Set("SignatureMethod", "HmacSHA256")
	if s.auth.Token() != "" {
		req.Form.Set("SecurityToken", s.auth.Token())
	}

	payload := req.Method + "\n" + req.URL.Host + "\n" + req.URL.Path + "\n" + EncodeSorted(req.Form)
	hash := hmac.New(sha256.New, []byte(s.auth.SecretKey))
	hash.Write([]byte(payload))
	signature := make([]byte, b64.EncodedLen(hash.Size()))
	b64.Encode(signature, hash.Sum(nil))

	req.Form.Set("Signature", string(signature))

	req.URL.RawQuery = req.Form.Encode()

	return nil
}

// Common date formats for signing requests
const (
	ISO8601BasicFormat      = "20060102T150405Z"
	ISO8601BasicFormatShort = "20060102"
)

type Route53Signer struct {
	auth Auth
}

func NewRoute53Signer(auth Auth) *Route53Signer {
	return &Route53Signer{auth: auth}
}

// Creates the authorize signature based on the date stamp and secret key
func (s *Route53Signer) getHeaderAuthorize(message string) string {
	hmacSha256 := hmac.New(sha256.New, []byte(s.auth.SecretKey))
	hmacSha256.Write([]byte(message))
	cryptedString := hmacSha256.Sum(nil)

	return base64.StdEncoding.EncodeToString(cryptedString)
}

// Adds all the required headers for AWS Route53 API to the request
// including the authorization
func (s *Route53Signer) Sign(req *http.Request) {
	date := time.Now().UTC().Format(time.RFC1123)
	delete(req.Header, "Date")
	req.Header.Set("Date", date)

	authHeader := fmt.Sprintf("AWS3-HTTPS AWSAccessKeyId=%s,Algorithm=%s,Signature=%s",
		s.auth.AccessKey, "HmacSHA256", s.getHeaderAuthorize(date))

	req.Header.Set("Host", req.Host)
	req.Header.Set("X-Amzn-Authorization", authHeader)
	req.Header.Set("Content-Type", "application/xml")
	if s.auth.Token() != "" {
		req.Header.Set("X-Amz-Security-Token", s.auth.Token())
	}
}

/*
The V4Signer encapsulates all of the functionality to sign a request with the AWS
Signature Version 4 Signing Process. (http://goo.gl/u1OWZz)
*/
type V4Signer struct {
	auth        Auth
	serviceName string
	region      Region
	// Add the x-amz-content-sha256 header
	IncludeXAmzContentSha256 bool
}

/*
Return a new instance of a V4Signer capable of signing AWS requests.
*/
func NewV4Signer(auth Auth, serviceName string, region Region) *V4Signer {
	return &V4Signer{
		auth:        auth,
		serviceName: serviceName,
		region:      region,
		IncludeXAmzContentSha256: false,
	}
}

/*
Sign a request according to the AWS Signature Version 4 Signing Process. (http://goo.gl/u1OWZz)

The signed request will include an "x-amz-date" header with a current timestamp if a valid "x-amz-date"
or "date" header was not available in the original request. In addition, AWS Signature Version 4 requires
the "host" header to be a signed header, therefor the Sign method will manually set a "host" header from
the request.Host.

The signed request will include a new "Authorization" header indicating that the request has been signed.

Any changes to the request after signing the request will invalidate the signature.
*/
func (s *V4Signer) Sign(req *http.Request) {
	req.Header.Set("host", req.Host) // host header must be included as a signed header
	t := s.requestTime(req)          // Get request time

	payloadHash := ""

	if _, ok := req.Form["X-Amz-Expires"]; ok {
		// We are authenticating the the request by using query params
		// (also known as pre-signing a url, http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html)
		payloadHash = "UNSIGNED-PAYLOAD"
		req.Header.Del("x-amz-date")

		req.Form["X-Amz-SignedHeaders"] = []string{s.signedHeaders(req.Header)}
		req.Form["X-Amz-Algorithm"] = []string{"AWS4-HMAC-SHA256"}
		req.Form["X-Amz-Credential"] = []string{s.auth.AccessKey + "/" + s.credentialScope(t)}
		req.Form["X-Amz-Date"] = []string{t.Format(ISO8601BasicFormat)}
		req.URL.RawQuery = req.Form.Encode()
	} else {
		payloadHash = s.payloadHash(req)
		if s.IncludeXAmzContentSha256 {
			req.Header.Set("x-amz-content-sha256", payloadHash) // x-amz-content-sha256 contains the payload hash
		}
	}
	creq := s.canonicalRequest(req, payloadHash)      // Build canonical request
	sts := s.stringToSign(t, creq)                    // Build string to sign
	signature := s.signature(t, sts)                  // Calculate the AWS Signature Version 4
	auth := s.authorization(req.Header, t, signature) // Create Authorization header value

	if _, ok := req.Form["X-Amz-Expires"]; ok {
		req.Form["X-Amz-Signature"] = []string{signature}
	} else {
		req.Header.Set("Authorization", auth) // Add Authorization header to request
	}
	return
}

func (s *V4Signer) SignRequest(req *http.Request) error {
	s.Sign(req)
	return nil
}

/*
requestTime method will parse the time from the request "x-amz-date" or "date" headers.
If the "x-amz-date" header is present, that will take priority over the "date" header.
If neither header is defined or we are unable to parse either header as a valid date
then we will create a new "x-amz-date" header with the current time.
*/
func (s *V4Signer) requestTime(req *http.Request) time.Time {

	// Get "x-amz-date" header
	date := req.Header.Get("x-amz-date")

	// Attempt to parse as ISO8601BasicFormat
	t, err := time.Parse(ISO8601BasicFormat, date)
	if err == nil {
		return t
	}

	// Attempt to parse as http.TimeFormat
	t, err = time.Parse(http.TimeFormat, date)
	if err == nil {
		req.Header.Set("x-amz-date", t.Format(ISO8601BasicFormat))
		return t
	}

	// Get "date" header
	date = req.Header.Get("date")

	// Attempt to parse as http.TimeFormat
	t, err = time.Parse(http.TimeFormat, date)
	if err == nil {
		return t
	}

	// Create a current time header to be used
	t = time.Now().UTC()
	req.Header.Set("x-amz-date", t.Format(ISO8601BasicFormat))
	return t
}

/*
canonicalRequest method creates the canonical request according to Task 1 of the AWS Signature Version 4 Signing Process. (http://goo.gl/eUUZ3S)

    CanonicalRequest =
      HTTPRequestMethod + '\n' +
      CanonicalURI + '\n' +
      CanonicalQueryString + '\n' +
      CanonicalHeaders + '\n' +
      SignedHeaders + '\n' +
      HexEncode(Hash(Payload))

payloadHash is optional; use the empty string and it will be calculated from the request
*/
func (s *V4Signer) canonicalRequest(req *http.Request, payloadHash string) string {
	if payloadHash == "" {
		payloadHash = s.payloadHash(req)
	}
	c := new(bytes.Buffer)
	fmt.Fprintf(c, "%s\n", req.Method)
	fmt.Fprintf(c, "%s\n", s.canonicalURI(req.URL))
	fmt.Fprintf(c, "%s\n", s.canonicalQueryString(req.URL))
	fmt.Fprintf(c, "%s\n\n", s.canonicalHeaders(req.Header))
	fmt.Fprintf(c, "%s\n", s.signedHeaders(req.Header))
	fmt.Fprintf(c, "%s", payloadHash)
	return c.String()
}

func (s *V4Signer) canonicalURI(u *url.URL) string {
	u = &url.URL{Path: u.Path}
	canonicalPath := u.String()

	slash := strings.HasSuffix(canonicalPath, "/")
	canonicalPath = path.Clean(canonicalPath)

	if canonicalPath == "" || canonicalPath == "." {
		canonicalPath = "/"
	}

	if canonicalPath != "/" && slash {
		canonicalPath += "/"
	}

	return canonicalPath
}

func (s *V4Signer) canonicalQueryString(u *url.URL) string {
	keyValues := make(map[string]string, len(u.Query()))
	keys := make([]string, len(u.Query()))

	key_i := 0
	for k, vs := range u.Query() {
		k = url.QueryEscape(k)

		a := make([]string, len(vs))
		for idx, v := range vs {
			v = url.QueryEscape(v)
			a[idx] = fmt.Sprintf("%s=%s", k, v)
		}

		keyValues[k] = strings.Join(a, "&")
		keys[key_i] = k
		key_i++
	}

	sort.Strings(keys)

	query := make([]string, len(keys))
	for idx, key := range keys {
		query[idx] = keyValues[key]
	}

	query_str := strings.Join(query, "&")

	// AWS V4 signing requires that the space characters
	// are encoded as %20 instead of +. On the other hand
	// golangs url.QueryEscape as well as url.Values.Encode()
	// both encode the space as a + character. See:
	// http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
	// https://github.com/golang/go/issues/4013
	// https://groups.google.com/forum/#!topic/golang-nuts/BB443qEjPIk

	return strings.Replace(query_str, "+", "%20", -1)
}

func (s *V4Signer) canonicalHeaders(h http.Header) string {
	i, a, lowerCase := 0, make([]string, len(h)), make(map[string][]string)

	for k, v := range h {
		lowerCase[strings.ToLower(k)] = v
	}

	var keys []string
	for k := range lowerCase {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		v := lowerCase[k]
		for j, w := range v {
			v[j] = strings.Trim(w, " ")
		}
		sort.Strings(v)
		a[i] = strings.ToLower(k) + ":" + strings.Join(v, ",")
		i++
	}
	return strings.Join(a, "\n")
}

func (s *V4Signer) signedHeaders(h http.Header) string {
	i, a := 0, make([]string, len(h))
	for k, _ := range h {
		a[i] = strings.ToLower(k)
		i++
	}
	sort.Strings(a)
	return strings.Join(a, ";")
}

func (s *V4Signer) payloadHash(req *http.Request) string {
	var b []byte
	if req.Body == nil {
		b = []byte("")
	} else {
		var err error
		b, err = ioutil.ReadAll(req.Body)
		if err != nil {
			// TODO: I REALLY DON'T LIKE THIS PANIC!!!!
			panic(err)
		}
	}
	req.Body = ioutil.NopCloser(bytes.NewBuffer(b))
	return s.hash(string(b))
}

/*
stringToSign method creates the string to sign accorting to Task 2 of the AWS Signature Version 4 Signing Process. (http://goo.gl/es1PAu)

    StringToSign  =
      Algorithm + '\n' +
      RequestDate + '\n' +
      CredentialScope + '\n' +
      HexEncode(Hash(CanonicalRequest))
*/
func (s *V4Signer) stringToSign(t time.Time, creq string) string {
	w := new(bytes.Buffer)
	fmt.Fprint(w, "AWS4-HMAC-SHA256\n")
	fmt.Fprintf(w, "%s\n", t.Format(ISO8601BasicFormat))
	fmt.Fprintf(w, "%s\n", s.credentialScope(t))
	fmt.Fprintf(w, "%s", s.hash(creq))
	return w.String()
}

func (s *V4Signer) credentialScope(t time.Time) string {
	return fmt.Sprintf("%s/%s/%s/aws4_request", t.Format(ISO8601BasicFormatShort), s.region.Name, s.serviceName)
}

/*
signature method calculates the AWS Signature Version 4 according to Task 3 of the AWS Signature Version 4 Signing Process. (http://goo.gl/j0Yqe1)

	signature = HexEncode(HMAC(derived-signing-key, string-to-sign))
*/
func (s *V4Signer) signature(t time.Time, sts string) string {
	h := s.hmac(s.derivedKey(t), []byte(sts))
	return fmt.Sprintf("%x", h)
}

/*
derivedKey method derives a signing key to be used for signing a request.

	kSecret = Your AWS Secret Access Key
    kDate = HMAC("AWS4" + kSecret, Date)
    kRegion = HMAC(kDate, Region)
    kService = HMAC(kRegion, Service)
    kSigning = HMAC(kService, "aws4_request")
*/
func (s *V4Signer) derivedKey(t time.Time) []byte {
	h := s.hmac([]byte("AWS4"+s.auth.SecretKey), []byte(t.Format(ISO8601BasicFormatShort)))
	h = s.hmac(h, []byte(s.region.Name))
	h = s.hmac(h, []byte(s.serviceName))
	h = s.hmac(h, []byte("aws4_request"))
	return h
}

/*
authorization method generates the authorization header value.
*/
func (s *V4Signer) authorization(header http.Header, t time.Time, signature string) string {
	w := new(bytes.Buffer)
	fmt.Fprint(w, "AWS4-HMAC-SHA256 ")
	fmt.Fprintf(w, "Credential=%s/%s, ", s.auth.AccessKey, s.credentialScope(t))
	fmt.Fprintf(w, "SignedHeaders=%s, ", s.signedHeaders(header))
	fmt.Fprintf(w, "Signature=%s", signature)
	return w.String()
}

// hash method calculates the sha256 hash for a given string
func (s *V4Signer) hash(in string) string {
	h := sha256.New()
	fmt.Fprintf(h, "%s", in)
	return fmt.Sprintf("%x", h.Sum(nil))
}

// hmac method calculates the sha256 hmac for a given slice of bytes
func (s *V4Signer) hmac(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}
