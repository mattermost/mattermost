package accesstoken

// Grant is a Twilio SID resource that can be added to an AccessToken for extra services.
type Grant interface {

	// Convert to JWT payload
	toPayload() map[string]interface{}

	// Return the JWT paylod key
	key() string
}

// IPMessageGrant is a grant for accessing Twilio IP Messaging
type IPMessageGrant struct {
	serviceSid string

	endpointID string

	deploymentRoleSid string

	pushCredentialSid string
}

// NewIPMessageGrant for Twilio IP Message service
func NewIPMessageGrant(serviceSid, endpointID, deploymentRoleSid, pushCredentialSid string) *IPMessageGrant {

	return &IPMessageGrant{
		serviceSid:        serviceSid,
		endpointID:        endpointID,
		deploymentRoleSid: deploymentRoleSid,
		pushCredentialSid: pushCredentialSid,
	}
}

func (t *IPMessageGrant) toPayload() map[string]interface{} {

	grant := make(map[string]interface{})

	if len(t.serviceSid) > 0 {
		grant["service_sid"] = t.serviceSid
	}
	if len(t.endpointID) > 0 {
		grant["endpoint_id"] = t.endpointID
	}
	if len(t.deploymentRoleSid) > 0 {
		grant["deployment_role_sid"] = t.deploymentRoleSid
	}
	if len(t.pushCredentialSid) > 0 {
		grant["push_credential_sid"] = t.pushCredentialSid
	}

	return grant
}

func (t *IPMessageGrant) key() string {
	return "ip_messaging"
}

// ConversationsGrant is for Twilio Programmable Video access
type ConversationsGrant struct {
	configurationProfileSid string
}

// NewConversationsGrant for Twilio Programmable Video access
func NewConversationsGrant(sid string) *ConversationsGrant {
	return &ConversationsGrant{configurationProfileSid: sid}
}

func (t *ConversationsGrant) toPayload() map[string]interface{} {

	if len(t.configurationProfileSid) > 0 {
		return map[string]interface{}{"configuration_profile_sid": t.configurationProfileSid}
	}

	return make(map[string]interface{})
}

func (t *ConversationsGrant) key() string {
	return "rtc"
}
