package elb

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"github.com/goamz/goamz/aws"
	"sort"
	"strings"
)

var b64 = base64.StdEncoding

func sign(auth aws.Auth, method, path string, params map[string]string, host string) {
	params["AWSAccessKeyId"] = auth.AccessKey
	params["SignatureVersion"] = "2"
	params["SignatureMethod"] = "HmacSHA256"

	var keys, sarray []string
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		sarray = append(sarray, aws.Encode(k)+"="+aws.Encode(params[k]))
	}
	joined := strings.Join(sarray, "&")
	payload := method + "\n" + host + "\n" + path + "\n" + joined
	hash := hmac.New(sha256.New, []byte(auth.SecretKey))
	hash.Write([]byte(payload))
	signature := make([]byte, b64.EncodedLen(hash.Size()))
	b64.Encode(signature, hash.Sum(nil))

	params["Signature"] = string(signature)
}
