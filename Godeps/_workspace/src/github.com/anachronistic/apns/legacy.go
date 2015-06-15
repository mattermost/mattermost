package apns

// This file exists to support backward-compatibility
// as I gradually refactor and overhaul. Ideally, golint
// should only complain about this file (and we should
// try to keep its complaints to a minimum).

// These variables map old identifiers to their current format.
var (
	APPLE_PUSH_RESPONSES     = ApplePushResponses
	FEEDBACK_TIMEOUT_SECONDS = FeedbackTimeoutSeconds
	IDENTIFIER_UBOUND        = IdentifierUbound
	MAX_PAYLOAD_SIZE_BYTES   = MaxPayloadSizeBytes
	TIMEOUT_SECONDS          = TimeoutSeconds
)
