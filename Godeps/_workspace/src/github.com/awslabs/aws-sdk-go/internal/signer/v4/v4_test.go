package v4

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func buildSigner(serviceName string, region string, signTime time.Time, expireTime time.Duration, body string) signer {
	endpoint := "https://" + serviceName + "." + region + ".amazonaws.com"
	reader := strings.NewReader(body)
	req, _ := http.NewRequest("POST", endpoint, reader)
	req.URL.Opaque = "//example.org/bucket/key-._~,!@#$%^&*()"
	req.Header.Add("X-Amz-Target", "prefix.Operation")
	req.Header.Add("Content-Type", "application/x-amz-json-1.0")
	req.Header.Add("Content-Length", string(len(body)))
	req.Header.Add("X-Amz-Meta-Other-Header", "some-value=!@#$%^&* ()")

	return signer{
		Request:         req,
		Time:            signTime,
		ExpireTime:      expireTime,
		Query:           req.URL.Query(),
		Body:            reader,
		ServiceName:     serviceName,
		Region:          region,
		AccessKeyID:     "AKID",
		SecretAccessKey: "SECRET",
		SessionToken:    "SESSION",
	}
}

func removeWS(text string) string {
	text = strings.Replace(text, " ", "", -1)
	text = strings.Replace(text, "\n", "", -1)
	text = strings.Replace(text, "\t", "", -1)
	return text
}

func assertEqual(t *testing.T, expected, given string) {
	if removeWS(expected) != removeWS(given) {
		t.Errorf("\nExpected: %s\nGiven:    %s", expected, given)
	}
}

func TestPresignRequest(t *testing.T) {
	signer := buildSigner("dynamodb", "us-east-1", time.Unix(0, 0), 300*time.Second, "{}")
	signer.sign()

	expectedDate := "19700101T000000Z"
	expectedHeaders := "host;x-amz-meta-other-header;x-amz-target"
	expectedSig := "41c18d68f9191079dfeead4e3f034328f89d86c79f8e9d51dd48bb70eaf623fc"
	expectedCred := "AKID/19700101/us-east-1/dynamodb/aws4_request"

	q := signer.Request.URL.Query()
	assert.Equal(t, expectedSig, q.Get("X-Amz-Signature"))
	assert.Equal(t, expectedCred, q.Get("X-Amz-Credential"))
	assert.Equal(t, expectedHeaders, q.Get("X-Amz-SignedHeaders"))
	assert.Equal(t, expectedDate, q.Get("X-Amz-Date"))
}

func TestSignRequest(t *testing.T) {
	signer := buildSigner("dynamodb", "us-east-1", time.Unix(0, 0), 0, "{}")
	signer.sign()

	expectedDate := "19700101T000000Z"
	expectedSig := "AWS4-HMAC-SHA256 Credential=AKID/19700101/us-east-1/dynamodb/aws4_request, SignedHeaders=host;x-amz-date;x-amz-meta-other-header;x-amz-security-token;x-amz-target, Signature=0196959cabd964bd10c05217b40ed151882dd394190438bab0c658dafdbff7a1"

	q := signer.Request.Header
	assert.Equal(t, expectedSig, q.Get("Authorization"))
	assert.Equal(t, expectedDate, q.Get("X-Amz-Date"))
}

func BenchmarkPresignRequest(b *testing.B) {
	signer := buildSigner("dynamodb", "us-east-1", time.Now(), 300*time.Second, "{}")
	for i := 0; i < b.N; i++ {
		signer.sign()
	}
}

func BenchmarkSignRequest(b *testing.B) {
	signer := buildSigner("dynamodb", "us-east-1", time.Now(), 0, "{}")
	for i := 0; i < b.N; i++ {
		signer.sign()
	}
}
