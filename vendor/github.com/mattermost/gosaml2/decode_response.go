package saml2

import (
	"bytes"
	"compress/flate"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io/ioutil"

	"encoding/xml"

	"github.com/beevik/etree"
	"github.com/mattermost/gosaml2/types"
	dsig "github.com/russellhaering/goxmldsig"
	"github.com/russellhaering/goxmldsig/etreeutils"
)

func (sp *SAMLServiceProvider) validationContext() *dsig.ValidationContext {
	ctx := dsig.NewDefaultValidationContext(sp.IDPCertificateStore)
	ctx.Clock = sp.Clock
	return ctx
}

// validateResponseAttributes validates a SAML Response's tag and attributes. It does
// not inspect child elements of the Response at all.
func (sp *SAMLServiceProvider) validateResponseAttributes(response *types.Response) error {
	if response.Destination != "" && response.Destination != sp.AssertionConsumerServiceURL {
		return ErrInvalidValue{
			Key:      DestinationAttr,
			Expected: sp.AssertionConsumerServiceURL,
			Actual:   response.Destination,
		}
	}

	if response.Version != "2.0" {
		return ErrInvalidValue{
			Reason:   ReasonUnsupported,
			Key:      "SAML version",
			Expected: "2.0",
			Actual:   response.Version,
		}
	}

	return nil
}

func xmlUnmarshalElement(el *etree.Element, obj interface{}) error {
	doc := etree.NewDocument()
	doc.SetRoot(el)
	data, err := doc.WriteToBytes()
	if err != nil {
		return err
	}

	err = xml.Unmarshal(data, obj)
	if err != nil {
		return err
	}
	return nil
}

func (sp *SAMLServiceProvider) getDecryptCert() (*tls.Certificate, error) {
	if sp.SPKeyStore == nil {
		return nil, fmt.Errorf("no decryption certs available")
	}

	//This is the tls.Certificate we'll use to decrypt any encrypted assertions
	var decryptCert tls.Certificate

	switch crt := sp.SPKeyStore.(type) {
	case dsig.TLSCertKeyStore:
		// Get the tls.Certificate directly if possible
		decryptCert = tls.Certificate(crt)

	default:

		//Otherwise, construct one from the results of GetKeyPair
		pk, cert, err := sp.SPKeyStore.GetKeyPair()
		if err != nil {
			return nil, fmt.Errorf("error getting keypair: %v", err)
		}

		decryptCert = tls.Certificate{
			Certificate: [][]byte{cert},
			PrivateKey:  pk,
		}
	}

	if sp.ValidateEncryptionCert {
		// Check Validity period of certificate
		if len(decryptCert.Certificate) < 1 || len(decryptCert.Certificate[0]) < 1 {
			return nil, fmt.Errorf("empty decryption cert")
		} else if cert, err := x509.ParseCertificate(decryptCert.Certificate[0]); err != nil {
			return nil, fmt.Errorf("invalid x509 decryption cert: %v", err)
		} else {
			now := sp.Clock.Now()
			if now.Before(cert.NotBefore) || now.After(cert.NotAfter) {
				return nil, fmt.Errorf("decryption cert is not valid at this time")
			}
		}
	}

	return &decryptCert, nil
}

func (sp *SAMLServiceProvider) decryptAssertions(el *etree.Element) error {
	var decryptCert *tls.Certificate

	decryptAssertion := func(ctx etreeutils.NSContext, encryptedElement *etree.Element) error {
		if encryptedElement.Parent() != el {
			return fmt.Errorf("found encrypted assertion with unexpected parent element: %s", encryptedElement.Parent().Tag)
		}

		detached, err := etreeutils.NSDetatch(ctx, encryptedElement) // make a detached copy
		if err != nil {
			return fmt.Errorf("unable to detach encrypted assertion: %v", err)
		}

		encryptedAssertion := &types.EncryptedAssertion{}
		err = xmlUnmarshalElement(detached, encryptedAssertion)
		if err != nil {
			return fmt.Errorf("unable to unmarshal encrypted assertion: %v", err)
		}

		if decryptCert == nil {
			decryptCert, err = sp.getDecryptCert()
			if err != nil {
				return fmt.Errorf("unable to get decryption certificate: %v", err)
			}
		}

		raw, derr := encryptedAssertion.DecryptBytes(decryptCert)
		if derr != nil {
			return fmt.Errorf("unable to decrypt encrypted assertion: %v", derr)
		}

		doc, _, err := parseResponse(raw)
		if err != nil {
			return fmt.Errorf("unable to create element from decrypted assertion bytes: %v", derr)
		}

		// Replace the original encrypted assertion with the decrypted one.
		if el.RemoveChild(encryptedElement) == nil {
			// Out of an abundance of caution, make sure removed worked
			panic("unable to remove encrypted assertion")
		}

		el.AddChild(doc.Root())
		return nil
	}

	if err := etreeutils.NSFindIterate(el, SAMLAssertionNamespace, EncryptedAssertionTag, decryptAssertion); err != nil {
		return err
	} else {
		return nil
	}
}

func (sp *SAMLServiceProvider) validateElementSignature(el *etree.Element) (*etree.Element, error) {
	return sp.validationContext().Validate(el)
}

func (sp *SAMLServiceProvider) validateAssertionSignatures(el *etree.Element) error {
	signedAssertions := 0
	unsignedAssertions := 0
	validateAssertion := func(ctx etreeutils.NSContext, unverifiedAssertion *etree.Element) error {
		if unverifiedAssertion.Parent() != el {
			return fmt.Errorf("found assertion with unexpected parent element: %s", unverifiedAssertion.Parent().Tag)
		}

		detached, err := etreeutils.NSDetatch(ctx, unverifiedAssertion) // make a detached copy
		if err != nil {
			return fmt.Errorf("unable to detach unverified assertion: %v", err)
		}

		assertion, err := sp.validationContext().Validate(detached)
		if err == dsig.ErrMissingSignature {
			unsignedAssertions++
			return nil
		} else if err != nil {
			return err
		}

		// Replace the original unverified Assertion with the verified one. Note that
		// if the Response is not signed, only signed Assertions (and not the parent Response) can be trusted.
		if el.RemoveChild(unverifiedAssertion) == nil {
			// Out of an abundance of caution, check to make sure an Assertion was actually
			// removed. If it wasn't a programming error has occurred.
			panic("unable to remove assertion")
		}

		el.AddChild(assertion)
		signedAssertions++

		return nil
	}

	if err := etreeutils.NSFindIterate(el, SAMLAssertionNamespace, AssertionTag, validateAssertion); err != nil {
		return err
	} else if signedAssertions > 0 && unsignedAssertions > 0 {
		return fmt.Errorf("invalid to have both signed and unsigned assertions")
	} else if signedAssertions < 1 {
		return dsig.ErrMissingSignature
	} else {
		return nil
	}
}

//ValidateEncodedResponse both decodes and validates, based on SP
//configuration, an encoded, signed response. It will also appropriately
//decrypt a response if the assertion was encrypted
func (sp *SAMLServiceProvider) ValidateEncodedResponse(encodedResponse string) (*types.Response, error) {
	raw, err := base64.StdEncoding.DecodeString(encodedResponse)
	if err != nil {
		return nil, err
	}

	// Parse the raw response
	doc, el, err := parseResponse(raw)
	if err != nil {
		return nil, err
	}

	var responseSignatureValidated bool
	if !sp.SkipSignatureValidation {
		el, err = sp.validateElementSignature(el)
		if err == dsig.ErrMissingSignature {
			// Unfortunately we just blew away our Response
			el = doc.Root()
		} else if err != nil {
			return nil, err
		} else if el == nil {
			return nil, fmt.Errorf("missing transformed response")
		} else {
			responseSignatureValidated = true
		}
	}

	err = sp.decryptAssertions(el)
	if err != nil {
		return nil, err
	}

	var assertionSignaturesValidated bool
	if !sp.SkipSignatureValidation {
		err = sp.validateAssertionSignatures(el)
		if err == dsig.ErrMissingSignature {
			if !responseSignatureValidated {
				return nil, fmt.Errorf("response and/or assertions must be signed")
			}
		} else if err != nil {
			return nil, err
		} else {
			assertionSignaturesValidated = true
		}
	}

	decodedResponse := &types.Response{}
	err = xmlUnmarshalElement(el, decodedResponse)
	if err != nil {
		return nil, fmt.Errorf("unable to unmarshal response: %v", err)
	}
	decodedResponse.SignatureValidated = responseSignatureValidated
	if assertionSignaturesValidated {
		for idx := 0; idx < len(decodedResponse.Assertions); idx++ {
			decodedResponse.Assertions[idx].SignatureValidated = true
		}
	}

	err = sp.Validate(decodedResponse)
	if err != nil {
		return nil, err
	}

	return decodedResponse, nil
}

// DecodeUnverifiedBaseResponse decodes several attributes from a SAML response for the purpose
// of determining how to validate the response. This is useful for Service Providers which
// expose a single Assertion Consumer Service URL but consume Responses from many IdPs.
func DecodeUnverifiedBaseResponse(encodedResponse string) (*types.UnverifiedBaseResponse, error) {
	raw, err := base64.StdEncoding.DecodeString(encodedResponse)
	if err != nil {
		return nil, err
	}

	var response *types.UnverifiedBaseResponse

	err = maybeDeflate(raw, func(maybeXML []byte) error {
		response = &types.UnverifiedBaseResponse{}
		return xml.Unmarshal(maybeXML, response)
	})
	if err != nil {
		return nil, err
	}

	return response, nil
}

// maybeDeflate invokes the passed decoder over the passed data. If an error is
// returned, it then attempts to deflate the passed data before re-invoking
// the decoder over the deflated data.
func maybeDeflate(data []byte, decoder func([]byte) error) error {
	err := decoder(data)
	if err == nil {
		return nil
	}

	deflated, err := ioutil.ReadAll(flate.NewReader(bytes.NewReader(data)))
	if err != nil {
		return err
	}

	return decoder(deflated)
}

// parseResponse is a helper function that was refactored out so that the XML parsing behavior can be isolated and unit tested
func parseResponse(xml []byte) (*etree.Document, *etree.Element, error) {
	var doc *etree.Document

	err := maybeDeflate(xml, func(xml []byte) error {
		doc = etree.NewDocument()
		return doc.ReadFromBytes(xml)
	})
	if err != nil {
		return nil, nil, err
	}

	el := doc.Root()
	if el == nil {
		return nil, nil, fmt.Errorf("unable to parse response")
	}

	return doc, el, nil
}
