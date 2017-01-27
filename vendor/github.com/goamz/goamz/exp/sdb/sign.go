package sdb

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"github.com/goamz/goamz/aws"
	"net/http"
	"net/url"
	"sort"
	"strings"
)

var b64 = base64.StdEncoding

// ----------------------------------------------------------------------------
// SimpleDB signing (http://goo.gl/CaY81)

func sign(auth aws.Auth, method, path string, params url.Values, headers http.Header) {
	var host string
	for k, v := range headers {
		k = strings.ToLower(k)
		switch k {
		case "host":
			host = v[0]
		}
	}

	// set up some defaults used for signing the request
	params["AWSAccessKeyId"] = []string{auth.AccessKey}
	params["SignatureVersion"] = []string{"2"}
	params["SignatureMethod"] = []string{"HmacSHA256"}
	if auth.Token() != "" {
		params["SecurityToken"] = []string{auth.Token()}
	}

	// join up all the incoming params
	var sarray []string
	for k, v := range params {
		sarray = append(sarray, aws.Encode(k)+"="+aws.Encode(v[0]))
	}
	sort.StringSlice(sarray).Sort()
	joined := strings.Join(sarray, "&")

	// create the payload, sign it and create the signature
	payload := strings.Join([]string{method, host, "/", joined}, "\n")
	hash := hmac.New(sha256.New, []byte(auth.SecretKey))
	hash.Write([]byte(payload))
	signature := make([]byte, b64.EncodedLen(hash.Size()))
	b64.Encode(signature, hash.Sum(nil))

	// add the signature to the outgoing params
	params["Signature"] = []string{string(signature)}
}
