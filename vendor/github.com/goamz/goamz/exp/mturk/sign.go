package mturk

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"github.com/goamz/goamz/aws"
)

var b64 = base64.StdEncoding

// ----------------------------------------------------------------------------
// Mechanical Turk signing (http://goo.gl/wrzfn)
func sign(auth aws.Auth, service, method, timestamp string, params map[string]string) {
	payload := service + method + timestamp
	hash := hmac.New(sha1.New, []byte(auth.SecretKey))
	hash.Write([]byte(payload))
	signature := make([]byte, b64.EncodedLen(hash.Size()))
	b64.Encode(signature, hash.Sum(nil))

	params["Signature"] = string(signature)
}
