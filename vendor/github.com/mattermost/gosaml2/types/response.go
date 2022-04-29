// Copyright 2016 Russell Haering et al.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"encoding/xml"
	"time"
)

// UnverifiedBaseResponse extracts several basic attributes of a SAML Response
// which may be useful in deciding how to validate the Response. An UnverifiedBaseResponse
// is parsed by this library prior to any validation of the Response, so the
// values it contains may have been supplied by an attacker and should not be
// trusted as authoritative from the IdP.
type UnverifiedBaseResponse struct {
	XMLName      xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol Response"`
	ID           string   `xml:"ID,attr"`
	InResponseTo string   `xml:"InResponseTo,attr"`
	Destination  string   `xml:"Destination,attr"`
	Version      string   `xml:"Version,attr"`
	Issuer       *Issuer  `xml:"Issuer"`
}

type Response struct {
	XMLName             xml.Name             `xml:"urn:oasis:names:tc:SAML:2.0:protocol Response"`
	ID                  string               `xml:"ID,attr"`
	InResponseTo        string               `xml:"InResponseTo,attr"`
	Destination         string               `xml:"Destination,attr"`
	Version             string               `xml:"Version,attr"`
	IssueInstant        time.Time            `xml:"IssueInstant,attr"`
	Status              *Status              `xml:"Status"`
	Issuer              *Issuer              `xml:"Issuer"`
	Assertions          []Assertion          `xml:"Assertion"`
	EncryptedAssertions []EncryptedAssertion `xml:"EncryptedAssertion"`
	SignatureValidated  bool                 `xml:"-"` // not read, not dumped
}

type LogoutResponse struct {
	XMLName            xml.Name  `xml:"urn:oasis:names:tc:SAML:2.0:protocol LogoutResponse"`
	ID                 string    `xml:"ID,attr"`
	InResponseTo       string    `xml:"InResponseTo,attr"`
	Destination        string    `xml:"Destination,attr"`
	Version            string    `xml:"Version,attr"`
	IssueInstant       time.Time `xml:"IssueInstant,attr"`
	Status             *Status   `xml:"Status"`
	Issuer             *Issuer   `xml:"Issuer"`
	SignatureValidated bool      `xml:"-"` // not read, not dumped
}

type Status struct {
	XMLName    xml.Name    `xml:"urn:oasis:names:tc:SAML:2.0:protocol Status"`
	StatusCode *StatusCode `xml:"StatusCode"`
}

type StatusCode struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol StatusCode"`
	Value   string   `xml:"Value,attr"`
}

type Issuer struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Value   string   `xml:",chardata"`
}

type Signature struct {
	SignatureDocument []byte `xml:",innerxml"`
}

type Assertion struct {
	XMLName            xml.Name            `xml:"urn:oasis:names:tc:SAML:2.0:assertion Assertion"`
	Version            string              `xml:"Version,attr"`
	ID                 string              `xml:"ID,attr"`
	IssueInstant       time.Time           `xml:"IssueInstant,attr"`
	Issuer             *Issuer             `xml:"Issuer"`
	Signature          *Signature          `xml:"Signature"`
	Subject            *Subject            `xml:"Subject"`
	Conditions         *Conditions         `xml:"Conditions"`
	AttributeStatement *AttributeStatement `xml:"AttributeStatement"`
	AuthnStatement     *AuthnStatement     `xml:"AuthnStatement"`
	SignatureValidated bool                `xml:"-"` // not read, not dumped
}

type Subject struct {
	XMLName             xml.Name             `xml:"urn:oasis:names:tc:SAML:2.0:assertion Subject"`
	NameID              *NameID              `xml:"NameID"`
	SubjectConfirmation *SubjectConfirmation `xml:"SubjectConfirmation"`
}

type AuthnContext struct {
	XMLName              xml.Name              `xml:urn:oasis:names:tc:SAML:2.0:assertion AuthnContext"`
	AuthnContextClassRef *AuthnContextClassRef `xml:"AuthnContextClassRef"`
}

type AuthnContextClassRef struct {
	XMLName xml.Name `xml:urn:oasis:names:tc:SAML:2.0:assertion AuthnContextClassRef"`
	Value   string   `xml:",chardata"`
}

type NameID struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion NameID"`
	Value   string   `xml:",chardata"`
}

type SubjectConfirmation struct {
	XMLName                 xml.Name                 `xml:"urn:oasis:names:tc:SAML:2.0:assertion SubjectConfirmation"`
	Method                  string                   `xml:"Method,attr"`
	SubjectConfirmationData *SubjectConfirmationData `xml:"SubjectConfirmationData"`
}

type SubjectConfirmationData struct {
	XMLName      xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion SubjectConfirmationData"`
	NotOnOrAfter string   `xml:"NotOnOrAfter,attr"`
	Recipient    string   `xml:"Recipient,attr"`
	InResponseTo string   `xml:"InResponseTo,attr"`
}

type Conditions struct {
	XMLName              xml.Name              `xml:"urn:oasis:names:tc:SAML:2.0:assertion Conditions"`
	NotBefore            string                `xml:"NotBefore,attr"`
	NotOnOrAfter         string                `xml:"NotOnOrAfter,attr"`
	AudienceRestrictions []AudienceRestriction `xml:"AudienceRestriction"`
	OneTimeUse           *OneTimeUse           `xml:"OneTimeUse"`
	ProxyRestriction     *ProxyRestriction     `xml:"ProxyRestriction"`
}

type AudienceRestriction struct {
	XMLName   xml.Name   `xml:"urn:oasis:names:tc:SAML:2.0:assertion AudienceRestriction"`
	Audiences []Audience `xml:"Audience"`
}

type Audience struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion Audience"`
	Value   string   `xml:",chardata"`
}

type OneTimeUse struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion OneTimeUse"`
}

type ProxyRestriction struct {
	XMLName  xml.Name   `xml:"urn:oasis:names:tc:SAML:2.0:assertion ProxyRestriction"`
	Count    int        `xml:"Count,attr"`
	Audience []Audience `xml:"Audience"`
}

type AttributeStatement struct {
	XMLName    xml.Name    `xml:"urn:oasis:names:tc:SAML:2.0:assertion AttributeStatement"`
	Attributes []Attribute `xml:"Attribute"`
}

type Attribute struct {
	XMLName      xml.Name         `xml:"urn:oasis:names:tc:SAML:2.0:assertion Attribute"`
	FriendlyName string           `xml:"FriendlyName,attr"`
	Name         string           `xml:"Name,attr"`
	NameFormat   string           `xml:"NameFormat,attr"`
	Values       []AttributeValue `xml:"AttributeValue"`
}

type AttributeValue struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion AttributeValue"`
	Type    string   `xml:"xsi:type,attr"`
	Value   string   `xml:",chardata"`
}

type AuthnStatement struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion AuthnStatement"`
	//Section 4.1.4.2 - https://docs.oasis-open.org/security/saml/v2.0/saml-profiles-2.0-os.pdf
	//If the identity provider supports the Single Logout profile, defined in Section 4.4
	//, any such authentication statements MUST include a SessionIndex attribute to enable
	//per-session logout requests by the service provider.
	SessionIndex        string        `xml:"SessionIndex,attr,omitempty"`
	AuthnInstant        *time.Time    `xml:"AuthnInstant,attr,omitempty"`
	SessionNotOnOrAfter *time.Time    `xml:"SessionNotOnOrAfter,attr,omitempty"`
	AuthnContext        *AuthnContext `xml:"AuthnContext"`
}
