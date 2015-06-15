package apns

// The maximum number of seconds we're willing to wait for a response
// from the Apple Push Notification Service.
const TimeoutSeconds = 5

// This enumerates the response codes that Apple defines
// for push notification attempts.
var ApplePushResponses = map[uint8]string{
	0:   "NO_ERRORS",
	1:   "PROCESSING_ERROR",
	2:   "MISSING_DEVICE_TOKEN",
	3:   "MISSING_TOPIC",
	4:   "MISSING_PAYLOAD",
	5:   "INVALID_TOKEN_SIZE",
	6:   "INVALID_TOPIC_SIZE",
	7:   "INVALID_PAYLOAD_SIZE",
	8:   "INVALID_TOKEN",
	10:  "SHUTDOWN",
	255: "UNKNOWN",
}

// PushNotificationResponse details what Apple had to say, if anything.
type PushNotificationResponse struct {
	Success       bool
	AppleResponse string
	Error         error
}

// NewPushNotificationResponse creates and returns a new PushNotificationResponse
// structure; it defaults to being unsuccessful at first.
func NewPushNotificationResponse() (resp *PushNotificationResponse) {
	resp = new(PushNotificationResponse)
	resp.Success = false
	return
}
