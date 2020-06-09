package saml2

import "time"

// AuthNRequest is the go struct representation of an authentication request
type AuthNRequest struct {
	ID                          string `xml:",attr"`
	Version                     string `xml:",attr"`
	ProtocolBinding             string `xml:",attr"`
	AssertionConsumerServiceURL string `xml:",attr"`

	IssueInstant time.Time `xml:",attr"`

	Destination string `xml:",attr"`
	Issuer      string
}
