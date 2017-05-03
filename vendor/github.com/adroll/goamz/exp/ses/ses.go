package ses

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/AdRoll/goamz/aws"
)

const MAX_RECIPIENTS_PER_REQUEST = 50

type SES struct {
	Auth   aws.Auth
	Region aws.Region
}

// Represents the destination of the message, consisting
// of To:, CC:, and BCC: fields.
type Destination struct {
	ToAddresses  []string
	CcAddresses  []string
	BccAddresses []string
}

// Represents textual data, plus an optional character set specification.
// By default, the text must be 7-bit ASCII, due to the constraints of the
// SMTP protocol. If the text must contain any other characters, then you must
// also specify a character set. Examples include UTF-8, ISO-8859-1, and Shift_JIS.
type Content struct {
	Charset string
	Data    string
}

// Represents the body of the message. You can specify text, HTML,
// or both. If you use both, then the message should display
// correctly in the widest variety of email clients.
type Body struct {
	Html *Content
	Text *Content
}

// Represents the message to be sent, composed of a subject and a body.
type Message struct {
	Subject *Content
	Body    *Body
}

type SendEmailResult struct {
	MessageId string `xml:"MessageId"`
}

type ResponseMetadata struct {
	MessageId string `xml:"RequestId"`
}

// Represents a unique message ID returned from a successful SendEmail request.
type SendEmailResponse struct {
	XMLName          xml.Name         `xml:"SendEmailResponse"`
	SendEmailResult  SendEmailResult  `xml:"SendEmailResult"`
	ResponseMetadata ResponseMetadata `xml:"ResponseMetadata"`
}

type SendRawEmailResult struct {
	MessageId string `xml:"MessageId"`
}

type SendRawEmailResponse struct {
	XMLName            xml.Name           `xml:"SendRawEmailResponse"`
	SendRawEmailResult SendRawEmailResult `xml:"SendRawEmailResult"`
	ResponseMetadata   ResponseMetadata   `xml:"ResponseMetadata"`
}

type Error struct {
	StatusCode int    `xml:"StatusCode"`
	Code       string `xml:"Code"`
	Message    string `xml:"Message"`
}

func (err *Error) Error() string {
	if err.Code == "" {
		return err.Message
	}
	return fmt.Sprintf("%s (%s)", err.Message, err.Code)
}

func (err *Error) String() string {
	return err.Message
}

type ErrorResponse struct {
	XMLName   xml.Name `xml:"ErrorResponse"`
	RequestId string   `xml:"RequestId"`
	Error     Error    `xml:"Error"`
}

// Creates a new destination
// TODO: specify address encoding
func NewDestination(toAddresses, ccAddresses, bccAddresses []string) *Destination {
	return &Destination{
		ToAddresses:  toAddresses,
		CcAddresses:  ccAddresses,
		BccAddresses: bccAddresses,
	}
}

// Creates a new message with UTF-8 encoding
func NewMessage(subject, textBody, htmlBody string) *Message {
	return &Message{
		Subject: &Content{
			Data:    subject,
			Charset: "utf-8",
		},
		Body: &Body{
			Text: &Content{
				Data:    textBody,
				Charset: "utf-8",
			},
			Html: &Content{
				Data:    htmlBody,
				Charset: "utf-8",
			},
		},
	}
}

// Creates a new instance of the SES client
func New(auth aws.Auth, region aws.Region) *SES {
	return &SES{
		Auth:   auth,
		Region: region,
	}
}

// Composes an email message and sends it.
// See http://docs.aws.amazon.com/ses/latest/APIReference/API_SendEmail.html
func (s *SES) SendEmail(
	fromAddress string,
	destination *Destination,
	message *Message,
) (*SendEmailResponse, error) {
	if err := enforceMaxRecipients(destination); err != nil {
		return nil, err
	}

	params := s.makeCommonParams("SendEmail")

	params.Add("Source", fromAddress)
	for index, addrs := range destination.ToAddresses {
		params.Add(fmt.Sprintf("Destination.ToAddresses.member.%d", index+1), addrs)
	}
	for index, addrs := range destination.CcAddresses {
		params.Add(fmt.Sprintf("Destination.CcAddresses.member.%d", index+1), addrs)
	}
	for index, addrs := range destination.BccAddresses {
		params.Add(fmt.Sprintf("Destination.BccAddresses.member.%d", index+1), addrs)
	}
	params.Add("Message.Subject.Data", message.Subject.Data)
	params.Add("Message.Subject.Charset", message.Subject.Charset)
	params.Add("Message.Body.Text.Data", message.Body.Text.Data)
	params.Add("Message.Body.Text.Charset", message.Body.Text.Charset)
	params.Add("Message.Body.Html.Data", message.Body.Html.Data)
	params.Add("Message.Body.Html.Charset", message.Body.Html.Charset)

	resp := SendEmailResponse{}
	if err := s.postSendRequest(params, &resp); err != nil {
		return nil, err
	}

	return &resp, nil
}

// Sends a raw email message as is.
// See http://docs.aws.amazon.com/ses/latest/APIReference/API_SendRawEmail.html
func (s *SES) SendRawEmail(
	destinations []string,
	rawMessage []byte,
) (*SendRawEmailResponse, error) {
	params := s.makeCommonParams("SendRawEmail")

	for index, addr := range destinations {
		params.Add(fmt.Sprintf("Destinations.member.%d", index+1), addr)
	}
	params.Add("RawMessage.Data",
		base64.StdEncoding.EncodeToString(rawMessage))

	resp := SendRawEmailResponse{}
	if err := s.postSendRequest(params, &resp); err != nil {
		return nil, err
	}

	return &resp, nil
}

func (s *SES) makeCommonParams(action string) url.Values {
	params := make(url.Values)

	params.Add("AWSAccessKeyId", s.Auth.AccessKey)
	params.Add("Action", action)

	return params
}

func (s *SES) postSendRequest(params url.Values, resp interface{}) error {
	body := strings.NewReader(params.Encode())
	req, err := http.NewRequest("POST", s.Region.SESEndpoint, body)
	if err != nil {
		return err
	}
	req.Header = s.composeRequestHeader()

	client := &http.Client{}

	r, err := client.Do(req)
	if err != nil {
		return err
	}
	defer r.Body.Close()

	if r.StatusCode != 200 {
		return buildError(r)
	}

	err = xml.NewDecoder(r.Body).Decode(&resp)
	if err != nil {
		return err
	}

	return nil
}

// http://docs.aws.amazon.com/ses/latest/APIReference/API_SendEmail.html
func enforceMaxRecipients(d *Destination) error {
	addressCount := len(d.ToAddresses) + len(d.CcAddresses) + len(d.BccAddresses)
	if addressCount > MAX_RECIPIENTS_PER_REQUEST {
		return fmt.Errorf("Too many recipients. Found: %d, max %d", addressCount, MAX_RECIPIENTS_PER_REQUEST)
	}
	return nil
}

func (s *SES) composeRequestHeader() http.Header {
	headers := http.Header{}
	now := time.Now().UTC()
	date := now.Format("Mon, 02 Jan 2006 15:04:05 -0700")
	headers.Set("Date", date)
	if s.Auth.Token() != "" {
		headers.Set("X-Amz-Security-Token", s.Auth.Token())
	}

	h := hmac.New(sha256.New, []uint8(s.Auth.SecretKey))
	h.Write([]uint8(date))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))
	auth := fmt.Sprintf("AWS3-HTTPS AWSAccessKeyId=%s, Algorithm=HmacSHA256, Signature=%s", s.Auth.AccessKey, signature)
	headers.Set("X-Amzn-Authorization", auth)
	headers.Set("Content-Type", "application/x-www-form-urlencoded")
	return headers
}

func buildError(r *http.Response) error {
	errorResponse := ErrorResponse{}
	err := xml.NewDecoder(r.Body).Decode(&errorResponse)
	if err != nil {
		return err
	}
	return &errorResponse.Error
}
