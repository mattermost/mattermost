package cloudfront

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type CloudFront struct {
	BaseURL   string
	keyPairId string
	key       *rsa.PrivateKey
}

var base64Replacer = strings.NewReplacer("=", "_", "+", "-", "/", "~")

func New(baseurl string, key *rsa.PrivateKey, keyPairId string) *CloudFront {
	return &CloudFront{
		BaseURL:   baseurl,
		keyPairId: keyPairId,
		key:       key,
	}
}

type epochTime struct {
	EpochTime int64 `json:"AWS:EpochTime"`
}

type condition struct {
	DateLessThan epochTime
}

type statement struct {
	Resource  string
	Condition condition
}

type policy struct {
	Statement []statement
}

func buildPolicy(resource string, expireTime time.Time) ([]byte, error) {
	p := &policy{
		Statement: []statement{
			statement{
				Resource: resource,
				Condition: condition{
					DateLessThan: epochTime{
						EpochTime: expireTime.Truncate(time.Millisecond).Unix(),
					},
				},
			},
		},
	}

	return json.Marshal(p)
}

func (cf *CloudFront) generateSignature(policy []byte) (string, error) {
	hash := sha1.New()
	if _, err := hash.Write(policy); err != nil {
		return "", err
	}

	hashed := hash.Sum(nil)

	signed, err := rsa.SignPKCS1v15(rand.Reader, cf.key, crypto.SHA1, hashed)
	if err != nil {
		return "", err
	}

	encoded := base64Replacer.Replace(base64.StdEncoding.EncodeToString(signed))

	return encoded, nil
}

// Creates a signed url using RSAwithSHA1 as specified by
// http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-creating-signed-url-canned-policy.html#private-content-canned-policy-creating-signature
func (cf *CloudFront) CannedSignedURL(path, queryString string, expires time.Time) (string, error) {
	resource := cf.BaseURL + path
	if queryString != "" {
		resource = path + "?" + queryString
	}

	policy, err := buildPolicy(resource, expires)
	if err != nil {
		return "", err
	}

	signature, err := cf.generateSignature(policy)
	if err != nil {
		return "", err
	}

	// TOOD: Do this once
	uri, err := url.Parse(cf.BaseURL)
	if err != nil {
		return "", err
	}

	uri.RawQuery = queryString
	if queryString != "" {
		uri.RawQuery += "&"
	}

	expireTime := expires.Truncate(time.Millisecond).Unix()

	uri.Path = path
	uri.RawQuery += fmt.Sprintf("Expires=%d&Signature=%s&Key-Pair-Id=%s", expireTime, signature, cf.keyPairId)

	return uri.String(), nil
}

func (cloudfront *CloudFront) SignedURL(path, querystrings string, expires time.Time) string {
	policy := `{"Statement":[{"Resource":"` + path + "?" + querystrings + `,"Condition":{"DateLessThan":{"AWS:EpochTime":` + strconv.FormatInt(expires.Truncate(time.Millisecond).Unix(), 10) + `}}}]}`

	hash := sha1.New()
	hash.Write([]byte(policy))
	b := hash.Sum(nil)
	he := base64.StdEncoding.EncodeToString(b)

	policySha1 := he

	url := cloudfront.BaseURL + path + "?" + querystrings + "&Expires=" + strconv.FormatInt(expires.Unix(), 10) + "&Signature=" + policySha1 + "&Key-Pair-Id=" + cloudfront.keyPairId

	return url
}
