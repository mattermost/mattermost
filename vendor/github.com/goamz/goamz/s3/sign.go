package s3

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"github.com/goamz/goamz/aws"
	"log"
	"sort"
	"strings"
)

var b64 = base64.StdEncoding

// ----------------------------------------------------------------------------
// S3 signing (http://goo.gl/G1LrK)

var s3ParamsToSign = map[string]bool{
	"acl":                          true,
	"location":                     true,
	"logging":                      true,
	"notification":                 true,
	"partNumber":                   true,
	"policy":                       true,
	"requestPayment":               true,
	"torrent":                      true,
	"uploadId":                     true,
	"uploads":                      true,
	"versionId":                    true,
	"versioning":                   true,
	"versions":                     true,
	"response-content-type":        true,
	"response-content-language":    true,
	"response-expires":             true,
	"response-cache-control":       true,
	"response-content-disposition": true,
	"response-content-encoding":    true,
	"website":                      true,
	"delete":                       true,
}

type keySortableTupleList []keySortableTuple

type keySortableTuple struct {
	Key         string
	TupleString string
}

func (l keySortableTupleList) StringSlice() []string {
	slice := make([]string, len(l))
	for i, v := range l {
		slice[i] = v.TupleString
	}
	return slice
}

func (l keySortableTupleList) Len() int {
	return len(l)
}

func (l keySortableTupleList) Less(i, j int) bool {
	return l[i].Key < l[j].Key
}

func (l keySortableTupleList) Swap(i, j int) {
	l[i], l[j] = l[j], l[i]
}

func sign(auth aws.Auth, method, canonicalPath string, params, headers map[string][]string) {
	var md5, ctype, date, xamz string
	var xamzDate bool
	var sarray keySortableTupleList
	for k, v := range headers {
		k = strings.ToLower(k)
		switch k {
		case "content-md5":
			md5 = v[0]
		case "content-type":
			ctype = v[0]
		case "date":
			if !xamzDate {
				date = v[0]
			}
		default:
			if strings.HasPrefix(k, "x-amz-") {
				vall := strings.Join(v, ",")
				sarray = append(sarray, keySortableTuple{k, k + ":" + vall})
				if k == "x-amz-date" {
					xamzDate = true
					date = ""
				}
			}
		}
	}
	if len(sarray) > 0 {
		sort.Sort(sarray)
		xamz = strings.Join(sarray.StringSlice(), "\n") + "\n"
	}

	expires := false
	if v, ok := params["Expires"]; ok {
		// Query string request authentication alternative.
		expires = true
		date = v[0]
		params["AWSAccessKeyId"] = []string{auth.AccessKey}
	}

	sarray = sarray[0:0]
	for k, v := range params {
		if s3ParamsToSign[k] {
			for _, vi := range v {
				if vi == "" {
					sarray = append(sarray, keySortableTuple{k, k})
				} else {
					// "When signing you do not encode these values."
					sarray = append(sarray, keySortableTuple{k, k + "=" + vi})
				}
			}
		}
	}
	if len(sarray) > 0 {
		sort.Sort(sarray)
		canonicalPath = canonicalPath + "?" + strings.Join(sarray.StringSlice(), "&")
	}

	payload := method + "\n" + md5 + "\n" + ctype + "\n" + date + "\n" + xamz + canonicalPath
	hash := hmac.New(sha1.New, []byte(auth.SecretKey))
	hash.Write([]byte(payload))
	signature := make([]byte, b64.EncodedLen(hash.Size()))
	b64.Encode(signature, hash.Sum(nil))

	if expires {
		params["Signature"] = []string{string(signature)}
	} else {
		headers["Authorization"] = []string{"AWS " + auth.AccessKey + ":" + string(signature)}
	}
	if debug {
		log.Printf("Signature payload: %q", payload)
		log.Printf("Signature: %q", signature)
	}
}
