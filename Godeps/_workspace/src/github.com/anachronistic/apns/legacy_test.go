package apns

import (
	"reflect"
	"testing"
)

// These identifiers were changed to resolve golint violations.
// However, it's possible that legacy code may rely on them. This
// will help avoid springing a breaking change on people.
func TestLegacyConstants(t *testing.T) {
	if !reflect.DeepEqual(APPLE_PUSH_RESPONSES, ApplePushResponses) {
		t.Error("expected APPLE_PUSH_RESPONSES to equal ApplePushResponses")
	}
	if !reflect.DeepEqual(FEEDBACK_TIMEOUT_SECONDS, FeedbackTimeoutSeconds) {
		t.Error("expected FEEDBACK_TIMEOUT_SECONDS to equal FeedbackTimeoutSeconds")
	}
	if !reflect.DeepEqual(IDENTIFIER_UBOUND, IdentifierUbound) {
		t.Error("expected IDENTIFIER_UBOUND to equal IdentifierUbound")
	}
	if !reflect.DeepEqual(MAX_PAYLOAD_SIZE_BYTES, MaxPayloadSizeBytes) {
		t.Error("expected MAX_PAYLOAD_SIZE_BYTES to equal MaxPayloadSizeBytes")
	}
	if !reflect.DeepEqual(TIMEOUT_SECONDS, TimeoutSeconds) {
		t.Error("expected TIMEOUT_SECONDS to equal TimeoutSeconds")
	}
}
