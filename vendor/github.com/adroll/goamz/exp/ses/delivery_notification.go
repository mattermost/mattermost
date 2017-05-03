package ses

import (
	"time"
)

//http://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#top-level-json-object
//http://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email-notifications-contents.html
const (
	NOTIFICATION_TYPE_BOUNCE    = "Bounce"
	NOTIFICATION_TYPE_COMPLAINT = "Complaint"
	NOTIFICATION_TYPE_DELIVERY  = "Delivery"
	NOTIFICATION_TYPE_RECEIVED  = "Received"

	//http://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#bounce-types
	BOUNCE_TYPE_UNDETERMINED           = "Undetermined"
	BOUNCE_TYPE_PERMANENT              = "Permanent"
	BOUNCE_TYPE_TRANSIENT              = "Transient"
	BOUNCE_SUBTYPE_UNDETERMINED        = "Undetermined"
	BOUNCE_SUBTYPE_GENERAL             = "General"
	BOUNCE_SUBTYPE_NO_EMAIL            = "NoEmail"
	BOUNCE_SUBTYPE_SUPPRESSED          = "Suppressed"
	BOUNCE_SUBTYPE_MAILBOX_FULL        = "MailboxFull"
	BOUNCE_SUBTYPE_MESSAGE_TOO_LARGE   = "MessageTooLarge"
	BOUNCE_SUBTYPE_CONTENT_REJECTED    = "ContentRejected"
	BOUNCE_SUBTYPE_ATTACHMENT_REJECTED = "AttachmentRejected"

	// http://www.iana.org/assignments/marf-parameters/marf-parameters.xml#marf-parameters-2
	COMPLAINT_FEEDBACK_TYPE_ABUSE        = "abuse"
	COMPLAINT_FEEDBACK_TYPE_AUTH_FAILURE = "auth-failure"
	COMPLAINT_FEEDBACK_TYPE_FRAUD        = "fraud"
	COMPLAINT_FEEDBACK_TYPE_NOT_SPAM     = "not-spam"
	COMPLAINT_FEEDBACK_TYPE_OTHER        = "other"
	COMPLAINT_FEEDBACK_TYPE_VIRUS        = "virus"

	// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email-notifications-contents.html#receiving-email-notifications-contents-dkimverdict-object
	VERDICT_STATUS_PASS              = "PASS"
	VERDICT_STATUS_FAIL              = "FAIL"
	VERDICT_STATUS_GRAY              = "GRAY"
	VERDICT_STATUS_PROCESSING_FAILED = "PROCESSING_FAILED"

	RECEIPT_ACTION_S3        = "S3"
	RECEIPT_ACTION_SNS       = "SNS"
	RECEIPT_ACTION_BOUNCE    = "Bounce"
	RECEIPT_ACTION_LAMBDA    = "Lambda"
	RECEIPT_ACTION_STOP      = "Stop"
	RECEIPT_ACTION_WORK_MAIL = "WorkMail"
)

type SNSNotification struct {
	NotificationType string     `json:"notificationType"`
	Bounce           *Bounce    `json:"bounce,omitempty"`
	Complaint        *Complaint `json:"complaint,omitempty"`
	Delivery         *Delivery  `json:"delivery,omitempty"`
	Receipt          *Receipt   `json:"receipt,omitempty"`
	Content          *string    `json:"content,omitempty"`
	Mail             *Mail      `json:"mail"`
}

type MailHeader struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type CommonHeaders struct {
	MessageId  string   `json:"messageId"`
	To         []string `json:"to"`
	From       []string `json:"from"`
	ReturnPath string   `json:"returnPath"`
	Date       string   `json:"date"`
	Subject    string   `json:"subject"`
}

// Represent the delivery of an email
type Mail struct {
	Timestamp        time.Time      `json:"timestamp"`
	MessageId        string         `json:"messageId"`
	Source           string         `json:"source"`
	Destination      []string       `json:"destination"`
	Headers          []MailHeader   `json:"headers,omitempty"`
	CommonHeaders    *CommonHeaders `json:"commonHeaders,omitempty"`
	HeadersTruncated bool           `json:"headersTruncated,omitempty"`
}

// A bounced recipient
// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#bounced-recipients
type BouncedRecipient struct {
	EmailAddress   string `json:"emailAddress"`
	Action         string `json:"action"`
	Status         string `json:"status"`
	DiagnosticCode string `json:"diagnosticCode"`
}

// A bounce notifiction object
// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#bounce-object
type Bounce struct {
	BounceType        string              `json:"bounceType"`
	BounceSubType     string              `json:"bounceSubType"`
	BouncedRecipients []*BouncedRecipient `json:"bouncedRecipients"`
	ReportingMTA      string              `json:"reportingMTA"`
	Timestamp         time.Time           `json:"timestamp"`
	FeedbackId        string              `json:"feedbackId"`
}

// A receipient which complained
// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#complained-recipients
type ComplainedRecipient struct {
	EmailAddress string `json:"emailAddress"`
}

// A complain notification object
// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#complaint-object
type Complaint struct {
	UserAgent             string                 `json:"userAgent"`
	ComplainedRecipients  []*ComplainedRecipient `json:"complainedRecipients"`
	ComplaintFeedbackType string                 `json:"complaintFeedbackType"`
	ArrivalDate           time.Time              `json:"arrivalDate"`
	Timestamp             time.Time              `json:"timestamp"`
	FeedbackId            string                 `json:"feedbackId"`
}

// A successful delivery
// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#delivery-object
type Delivery struct {
	Timestamp            time.Time `json:"timestamp"`
	ProcessingTimeMillis int64     `json:"processingTimeMillis"`
	Recipients           []string  `json:"recipients"`
	SmtpResponse         string    `json:"smtpResponse"`
	ReportingMTA         string    `json:"reportingMTA"`
}

type CheckVerdict struct {
	Status string `json:"status"`
}

type ReceiptAction struct {
	Type            string `json:"type"`
	TopicArn        string `json:"topicArn"`
	BucketName      string `json:"bucketName,omitempty"`
	ObjectKey       string `json:"objectKey,omitempty"`
	SmtpReplyCode   string `json:"smtpReplyCode,omitempty"`
	StatusCode      string `json:"statusCode,omitempty"`
	Message         string `json:"message,omitempty"`
	Sender          string `json:"sender,omitempty"`
	FunctionArn     string `json:"functionArn,omitempty"`
	InvocationType  string `json:"invocationType,omitempty"`
	OrganizationArn string `json:"organizationArn,omitempty"`
}

// A receipt event
// http://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email-notifications-contents.html#receiving-email-notifications-contents-receipt-object
type Receipt struct {
	Action               ReceiptAction `json:"action"`
	Timestamp            time.Time     `json:"timestamp"`
	ProcessingTimeMillis int64         `json:"processingTimeMillis"`
	Recipients           []string      `json:"recipients"`
	DkimVerdict          CheckVerdict  `json:"dkimVerdict"`
	SpamVerdict          CheckVerdict  `json:"spamVerdict"`
	SpfVerdict           CheckVerdict  `json:"spfVerdict"`
	VirusVerdict         CheckVerdict  `json:"virusVerdict"`
}
