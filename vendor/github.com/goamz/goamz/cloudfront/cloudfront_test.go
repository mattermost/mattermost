package cloudfront

import (
	"crypto/x509"
	"encoding/pem"
	"io/ioutil"
	"net/url"
	"testing"
	"time"
)

func TestSignedCannedURL(t *testing.T) {
	rawKey, err := ioutil.ReadFile("testdata/key.pem")
	if err != nil {
		t.Fatal(err)
	}

	pemKey, _ := pem.Decode(rawKey)
	privateKey, err := x509.ParsePKCS1PrivateKey(pemKey.Bytes)
	if err != nil {
		t.Fatal(err)
	}

	cf := &CloudFront{
		key:       privateKey,
		keyPairId: "test-key-pair-1231245",
		BaseURL:   "https://cloudfront.com",
	}

	expireTime, err := time.Parse(time.RFC3339, "2014-03-28T14:00:21Z")
	if err != nil {
		t.Fatal(err)
	}

	query := make(url.Values)
	query.Add("test", "value")

	uri, err := cf.CannedSignedURL("test", "test=value", expireTime)
	if err != nil {
		t.Fatal(err)
	}

	parsed, err := url.Parse(uri)
	if err != nil {
		t.Fatal(err)
	}

	signature := parsed.Query().Get("Signature")
	if signature == "" {
		t.Fatal("Encoded signature is empty")
	}
}
