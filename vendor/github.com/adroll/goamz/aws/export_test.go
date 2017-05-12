package aws

import (
	"net/http"
	"time"
)

// V4Signer:
// Exporting methods for testing

func (s *V4Signer) RequestTime(req *http.Request) time.Time {
	return s.requestTime(req)
}

func (s *V4Signer) CanonicalRequest(req *http.Request) string {
	return s.canonicalRequest(req, "")
}

func (s *V4Signer) StringToSign(t time.Time, creq string) string {
	return s.stringToSign(t, creq)
}

func (s *V4Signer) Signature(t time.Time, sts string) string {
	return s.signature(t, sts)
}

func (s *V4Signer) Authorization(header http.Header, t time.Time, signature string) string {
	return s.authorization(header, t, signature)
}
