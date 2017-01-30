package sns

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"github.com/goamz/goamz/aws"
	"sort"
	"strings"
)

var b64 = base64.StdEncoding

/*
func sign(auth aws.Auth, method, path string, params url.Values, headers http.Header) {
    var host string
    for k, v := range headers {
        k = strings.ToLower(k)
        switch k {
        case "host":
            host = v[0]
        }
    }

    params["AWSAccessKeyId"] = []string{auth.AccessKey}
    params["SignatureVersion"] = []string{"2"}
    params["SignatureMethod"] = []string{"HmacSHA256"}
    if auth.Token() != "" {
        params["SecurityToken"] = auth.Token()
    }

    var sarry []string
    for k, v := range params {
        sarry = append(sarry, aws.Encode(k) + "=" + aws.Encode(v[0]))
    }

    sort.StringSlice(sarry).Sort()
    joined := strings.Join(sarry, "&")

    payload := strings.Join([]string{method, host, "/", joined}, "\n")
    hash := hmac.NewSHA256([]byte(auth.SecretKey))
    hash.Write([]byte(payload))
    signature := make([]byte, b64.EncodedLen(hash.Size()))
    b64.Encode(signature, hash.Sum())

    params["Signature"] = []string{"AWS " + string(signature)}
    println("Payload:", payload)
    println("Signature:", strings.Join(params["Signature"], "|"))
}*/

func sign(auth aws.Auth, method, path string, params map[string]string, host string) {
	params["AWSAccessKeyId"] = auth.AccessKey
	if auth.Token() != "" {
		params["SecurityToken"] = auth.Token()
	}
	params["SignatureVersion"] = "2"
	params["SignatureMethod"] = "HmacSHA256"

	var sarray []string
	for k, v := range params {
		sarray = append(sarray, aws.Encode(k)+"="+aws.Encode(v))
	}
	sort.StringSlice(sarray).Sort()
	joined := strings.Join(sarray, "&")
	payload := method + "\n" + host + "\n" + path + "\n" + joined
	hash := hmac.New(sha256.New, []byte(auth.SecretKey))
	hash.Write([]byte(payload))
	signature := make([]byte, b64.EncodedLen(hash.Size()))
	b64.Encode(signature, hash.Sum(nil))

	params["Signature"] = string(signature)
}
