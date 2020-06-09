package saml2

const (
	ResponseTag                = "Response"
	AssertionTag               = "Assertion"
	EncryptedAssertionTag      = "EncryptedAssertion"
	SubjectTag                 = "Subject"
	NameIdTag                  = "NameID"
	SubjectConfirmationTag     = "SubjectConfirmation"
	SubjectConfirmationDataTag = "SubjectConfirmationData"
	AttributeStatementTag      = "AttributeStatement"
	AttributeValueTag          = "AttributeValue"
	ConditionsTag              = "Conditions"
	AudienceRestrictionTag     = "AudienceRestriction"
	AudienceTag                = "Audience"
	OneTimeUseTag              = "OneTimeUse"
	ProxyRestrictionTag        = "ProxyRestriction"
	IssuerTag                  = "Issuer"
	StatusTag                  = "Status"
	StatusCodeTag              = "StatusCode"
)

const (
	DestinationAttr  = "Destination"
	VersionAttr      = "Version"
	IdAttr           = "ID"
	MethodAttr       = "Method"
	RecipientAttr    = "Recipient"
	NameAttr         = "Name"
	NotBeforeAttr    = "NotBefore"
	NotOnOrAfterAttr = "NotOnOrAfter"
	CountAttr        = "Count"
)

const (
	NameIdFormatPersistent      = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"
	NameIdFormatTransient       = "urn:oasis:names:tc:SAML:2.0:nameid-format:transient"
	NameIdFormatEmailAddress    = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
	NameIdFormatUnspecified     = "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"
	NameIdFormatX509SubjectName = "urn:oasis:names:tc:SAML:1.1:nameid-format:x509SubjectName"

	AuthnContextPasswordProtectedTransport = "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport"

	AuthnPolicyMatchExact   = "exact"
	AuthnPolicyMatchMinimum = "minimum"
	AuthnPolicyMatchMaximum = "maximum"
	AuthnPolicyMatchBetter  = "better"

	StatusCodeSuccess = "urn:oasis:names:tc:SAML:2.0:status:Success"

	BindingHttpPost     = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
	BindingHttpRedirect = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
)

const (
	SAMLAssertionNamespace = "urn:oasis:names:tc:SAML:2.0:assertion"
	SAMLProtocolNamespace  = "urn:oasis:names:tc:SAML:2.0:protocol"
)
