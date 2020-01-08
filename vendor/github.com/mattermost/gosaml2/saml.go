package saml2

import (
	"encoding/base64"
	"sync"
	"time"

	"github.com/mattermost/gosaml2/types"
	dsig "github.com/russellhaering/goxmldsig"
	dsigtypes "github.com/russellhaering/goxmldsig/types"
)

type ErrSaml struct {
	Message string
	System  error
}

func (serr ErrSaml) Error() string {
	if serr.Message != "" {
		return serr.Message
	}
	return "SAML error"
}

type SAMLServiceProvider struct {
	IdentityProviderSSOURL string
	IdentityProviderIssuer string

	AssertionConsumerServiceURL string
	ServiceProviderIssuer       string

	SignAuthnRequests              bool
	SignAuthnRequestsAlgorithm     string
	SignAuthnRequestsCanonicalizer dsig.Canonicalizer

	// RequestedAuthnContext allows service providers to require that the identity
	// provider use specific authentication mechanisms. Leaving this unset will
	// permit the identity provider to choose the auth method. To maximize compatibility
	// with identity providers it is recommended to leave this unset.
	RequestedAuthnContext   *RequestedAuthnContext
	AudienceURI             string
	IDPCertificateStore     dsig.X509CertificateStore
	SPKeyStore              dsig.X509KeyStore // Required encryption key, default signing key
	SPSigningKeyStore       dsig.X509KeyStore // Optional signing key
	NameIdFormat            string
	ValidateEncryptionCert  bool
	SkipSignatureValidation bool
	AllowMissingAttributes  bool
	ScopingIDPProviderId    string
	ScopingIDPProviderName  string
	Clock                   *dsig.Clock
	signingContextMu        sync.RWMutex
	signingContext          *dsig.SigningContext
}

// RequestedAuthnContext controls which authentication mechanisms are requested of
// the identity provider. It is generally sufficient to omit this and let the
// identity provider select an authentication mechansim.
type RequestedAuthnContext struct {
	// The RequestedAuthnContext comparison policy to use. See the section 3.3.2.2.1
	// of the SAML 2.0 specification for details. Constants named AuthnPolicyMatch*
	// contain standardized values.
	Comparison string

	// Contexts will be passed as AuthnContextClassRefs. For example, to force password
	// authentication on some identity providers, Contexts should have a value of
	// []string{AuthnContextPasswordProtectedTransport}, and Comparison should have a
	// value of AuthnPolicyMatchExact.
	Contexts []string
}

func (sp *SAMLServiceProvider) Metadata() (*types.EntityDescriptor, error) {
	signingCertBytes, err := sp.GetSigningCertBytes()
	if err != nil {
		return nil, err
	}
	encryptionCertBytes, err := sp.GetEncryptionCertBytes()
	if err != nil {
		return nil, err
	}
	return &types.EntityDescriptor{
		ValidUntil: time.Now().UTC().Add(time.Hour * 24 * 7), // 7 days
		EntityID:   sp.ServiceProviderIssuer,
		SPSSODescriptor: &types.SPSSODescriptor{
			AuthnRequestsSigned:        sp.SignAuthnRequests,
			WantAssertionsSigned:       !sp.SkipSignatureValidation,
			ProtocolSupportEnumeration: SAMLProtocolNamespace,
			KeyDescriptors: []types.KeyDescriptor{
				{
					Use: "signing",
					KeyInfo: dsigtypes.KeyInfo{
						X509Data: dsigtypes.X509Data{
							X509Certificates: []dsigtypes.X509Certificate{dsigtypes.X509Certificate{
								Data: base64.StdEncoding.EncodeToString(signingCertBytes),
							}},
						},
					},
				},
				{
					Use: "encryption",
					KeyInfo: dsigtypes.KeyInfo{
						X509Data: dsigtypes.X509Data{
							X509Certificates: []dsigtypes.X509Certificate{dsigtypes.X509Certificate{
								Data: base64.StdEncoding.EncodeToString(encryptionCertBytes),
							}},
						},
					},
					EncryptionMethods: []types.EncryptionMethod{
						{Algorithm: types.MethodAES128GCM},
						{Algorithm: types.MethodAES128CBC},
						{Algorithm: types.MethodAES256CBC},
					},
				},
			},
			AssertionConsumerServices: []types.IndexedEndpoint{{
				Binding:  BindingHttpPost,
				Location: sp.AssertionConsumerServiceURL,
				Index:    1,
			}},
		},
	}, nil
}

func (sp *SAMLServiceProvider) GetEncryptionKey() dsig.X509KeyStore {
	return sp.SPKeyStore
}

func (sp *SAMLServiceProvider) GetSigningKey() dsig.X509KeyStore {
	if sp.SPSigningKeyStore == nil {
		return sp.GetEncryptionKey() // Default is signing key is same as encryption key
	}
	return sp.SPSigningKeyStore
}

func (sp *SAMLServiceProvider) GetEncryptionCertBytes() ([]byte, error) {
	if _, encryptionCert, err := sp.GetEncryptionKey().GetKeyPair(); err != nil {
		return nil, ErrSaml{Message: "no SP encryption certificate", System: err}
	} else if len(encryptionCert) < 1 {
		return nil, ErrSaml{Message: "empty SP encryption certificate"}
	} else {
		return encryptionCert, nil
	}
}

func (sp *SAMLServiceProvider) GetSigningCertBytes() ([]byte, error) {
	if _, signingCert, err := sp.GetSigningKey().GetKeyPair(); err != nil {
		return nil, ErrSaml{Message: "no SP signing certificate", System: err}
	} else if len(signingCert) < 1 {
		return nil, ErrSaml{Message: "empty SP signing certificate"}
	} else {
		return signingCert, nil
	}
}

func (sp *SAMLServiceProvider) SigningContext() *dsig.SigningContext {
	sp.signingContextMu.RLock()
	signingContext := sp.signingContext
	sp.signingContextMu.RUnlock()

	if signingContext != nil {
		return signingContext
	}

	sp.signingContextMu.Lock()
	defer sp.signingContextMu.Unlock()

	sp.signingContext = dsig.NewDefaultSigningContext(sp.GetSigningKey())
	sp.signingContext.SetSignatureMethod(sp.SignAuthnRequestsAlgorithm)
	if sp.SignAuthnRequestsCanonicalizer != nil {
		sp.signingContext.Canonicalizer = sp.SignAuthnRequestsCanonicalizer
	}

	return sp.signingContext
}

type ProxyRestriction struct {
	Count    int
	Audience []string
}

type WarningInfo struct {
	OneTimeUse       bool
	ProxyRestriction *ProxyRestriction
	NotInAudience    bool
	InvalidTime      bool
}

type AssertionInfo struct {
	NameID                     string
	Values                     Values
	WarningInfo                *WarningInfo
	AuthnInstant               *time.Time
	SessionNotOnOrAfter        *time.Time
	Assertions                 []types.Assertion
	ResponseSignatureValidated bool
}
