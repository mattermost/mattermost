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

package saml2

import (
	"bytes"
	"encoding/base64"
	"html/template"

	"github.com/beevik/etree"
	"github.com/mattermost/gosaml2/uuid"
)

func (sp *SAMLServiceProvider) buildLogoutResponse(statusCodeValue string, reqID string, includeSig bool) (*etree.Document, error) {
	logoutResponse := &etree.Element{
		Space: "samlp",
		Tag:   "LogoutResponse",
	}

	logoutResponse.CreateAttr("xmlns:samlp", "urn:oasis:names:tc:SAML:2.0:protocol")
	logoutResponse.CreateAttr("xmlns:saml", "urn:oasis:names:tc:SAML:2.0:assertion")

	arId := uuid.NewV4()

	logoutResponse.CreateAttr("ID", "_"+arId.String())
	logoutResponse.CreateAttr("Version", "2.0")
	logoutResponse.CreateAttr("IssueInstant", sp.Clock.Now().UTC().Format(issueInstantFormat))
	logoutResponse.CreateAttr("Destination", sp.IdentityProviderSLOURL)
	logoutResponse.CreateAttr("InResponseTo", reqID)

	// NOTE(russell_h): In earlier versions we mistakenly sent the IdentityProviderIssuer
	// in the AuthnRequest. For backwards compatibility we will fall back to that
	// behavior when ServiceProviderIssuer isn't set.
	if sp.ServiceProviderIssuer != "" {
		logoutResponse.CreateElement("saml:Issuer").SetText(sp.ServiceProviderIssuer)
	} else {
		logoutResponse.CreateElement("saml:Issuer").SetText(sp.IdentityProviderIssuer)
	}

	status := logoutResponse.CreateElement("samlp:Status")
	statusCode := status.CreateElement("samlp:StatusCode")
	statusCode.CreateAttr("Value", statusCodeValue)

	doc := etree.NewDocument()

	// Only POST binding includes <Signature> in <AuthnRequest> (includeSig)
	if includeSig {
		signed, err := sp.SignLogoutResponse(logoutResponse)
		if err != nil {
			return nil, err
		}

		doc.SetRoot(signed)
	} else {
		doc.SetRoot(logoutResponse)
	}
	return doc, nil
}
func (sp *SAMLServiceProvider) BuildLogoutResponseDocument(status string, reqID string) (*etree.Document, error) {
	return sp.buildLogoutResponse(status, reqID, true)
}

func (sp *SAMLServiceProvider) BuildLogoutResponseDocumentNoSig(status string, reqID string) (*etree.Document, error) {
	return sp.buildLogoutResponse(status, reqID, false)
}

func (sp *SAMLServiceProvider) SignLogoutResponse(el *etree.Element) (*etree.Element, error) {
	ctx := sp.SigningContext()

	sig, err := ctx.ConstructSignature(el, true)
	if err != nil {
		return nil, err
	}

	ret := el.Copy()

	var children []etree.Token
	children = append(children, ret.Child[0])     // issuer is always first
	children = append(children, sig)              // next is the signature
	children = append(children, ret.Child[1:]...) // then all other children
	ret.Child = children

	return ret, nil
}

func (sp *SAMLServiceProvider) buildLogoutResponseBodyPostFromDocument(relayState string, doc *etree.Document) ([]byte, error) {
	respBuf, err := doc.WriteToBytes()
	if err != nil {
		return nil, err
	}

	encodedRespBuf := base64.StdEncoding.EncodeToString(respBuf)

	var tmpl *template.Template
	var rv bytes.Buffer

	if relayState != "" {
		tmpl = template.Must(template.New("saml-post-form").Parse(`<html>` +
			`<form method="post" action="{{.URL}}" id="SAMLResponseForm">` +
			`<input type="hidden" name="SAMLResponse" value="{{.SAMLResponse}}" />` +
			`<input type="hidden" name="RelayState" value="{{.RelayState}}" />` +
			`<input id="SAMLSubmitButton" type="submit" value="Continue" />` +
			`</form>` +
			`<script>document.getElementById('SAMLSubmitButton').style.visibility='hidden';</script>` +
			`<script>document.getElementById('SAMLResponseForm').submit();</script>` +
			`</html>`))
		data := struct {
			URL          string
			SAMLResponse string
			RelayState   string
		}{
			URL:          sp.IdentityProviderSLOURL,
			SAMLResponse: encodedRespBuf,
			RelayState:   relayState,
		}
		if err = tmpl.Execute(&rv, data); err != nil {
			return nil, err
		}
	} else {
		tmpl = template.Must(template.New("saml-post-form").Parse(`<html>` +
			`<form method="post" action="{{.URL}}" id="SAMLResponseForm">` +
			`<input type="hidden" name="SAMLResponse" value="{{.SAMLResponse}}" />` +
			`<input id="SAMLSubmitButton" type="submit" value="Continue" />` +
			`</form>` +
			`<script>document.getElementById('SAMLSubmitButton').style.visibility='hidden';</script>` +
			`<script>document.getElementById('SAMLResponseForm').submit();</script>` +
			`</html>`))
		data := struct {
			URL          string
			SAMLResponse string
		}{
			URL:          sp.IdentityProviderSLOURL,
			SAMLResponse: encodedRespBuf,
		}

		if err = tmpl.Execute(&rv, data); err != nil {
			return nil, err
		}
	}

	return rv.Bytes(), nil
}

func (sp *SAMLServiceProvider) BuildLogoutResponseBodyPostFromDocument(relayState string, doc *etree.Document) ([]byte, error) {
	return sp.buildLogoutResponseBodyPostFromDocument(relayState, doc)
}
