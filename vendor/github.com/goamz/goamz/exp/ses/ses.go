// ses.go
package ses

import (
	"encoding/xml"
	"github.com/goamz/goamz/aws"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type SES struct {
	auth   aws.Auth
	region aws.Region
	client *http.Client
}

// Initializes a pointer to an SES struct which can be used
// to perform SES API calls.
func NewSES(auth aws.Auth, region aws.Region) *SES {
	ses := SES{auth, region, nil}
	return &ses
}

// Sends an email to the specifications stored in the Email struct.
func (ses *SES) SendEmail(email *Email) error {
	data := make(url.Values)

	index := 0
	for i := range email.destination.bccAddresses {
		if len(email.destination.bccAddresses[i]) > 0 {
			index += 1
			key := "Destination.BccAddresses.member." + strconv.Itoa(index)
			data.Add(key, email.destination.bccAddresses[i])
		}
	}

	index = 0
	for i := range email.destination.ccAddresses {
		if len(email.destination.ccAddresses[i]) > 0 {
			index += 1
			key := "Destination.CcAddresses.member." + strconv.Itoa(index)
			data.Add(key, email.destination.ccAddresses[i])
		}
	}

	index = 0
	for i := range email.destination.toAddresses {
		if len(email.destination.toAddresses[i]) > 0 {
			index += 1
			key := "Destination.ToAddresses.member." + strconv.Itoa(index)
			data.Add(key, email.destination.toAddresses[i])
		}
	}

	index = 0
	for i := range email.replyTo {
		if len(email.replyTo[i]) > 0 {
			index += 1
			key := "ReplyToAddresses.member." + strconv.Itoa(index)
			data.Add(key, email.replyTo[i])
		}
	}

	if len(email.message.Subject.Data) > 0 {
		if len(email.message.Subject.Charset) > 0 {
			data.Add("Message.Subject.Charset", email.message.Subject.Charset)
		}
		data.Add("Message.Subject.Data", email.message.Subject.Data)
	}

	if len(email.message.Body.Html.Data) > 0 {
		if len(email.message.Body.Html.Charset) > 0 {
			data.Add("Message.Body.Html.Charset", email.message.Body.Html.Charset)
		}
		data.Add("Message.Body.Html.Data", email.message.Body.Html.Data)
	}

	if len(email.message.Body.Text.Data) > 0 {
		if len(email.message.Body.Text.Charset) > 0 {
			data.Add("Message.Body.Text.Charset", email.message.Body.Text.Charset)
		}
		data.Add("Message.Body.Text.Data", email.message.Body.Text.Data)
	}

	if len(email.returnPath) > 0 {
		data.Add("ReturnPath", email.returnPath)
	}

	if len(email.source) > 0 {
		data.Add("Source", email.source)
	}

	return ses.doPost("SendEmail", data)
}

// Do an SES POST action.
func (ses *SES) doPost(action string, data url.Values) error {
	req := http.Request{
		Method:     "POST",
		ProtoMajor: 1,
		ProtoMinor: 1,
		Close:      true,
		Header:     http.Header{}}

	URL, err := url.Parse(ses.region.SESEndpoint)
	if err != nil {
		return err
	}
	URL.Path = "/"

	req.URL = URL
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	sign(ses.auth, "POST", req.Header)

	data.Add("AWSAccessKeyId", ses.auth.AccessKey)
	data.Add("Action", action)

	body := data.Encode()
	req.Header.Add("Content-Length", strconv.Itoa(len(body)))
	req.Body = ioutil.NopCloser(strings.NewReader(body))

	if ses.client == nil {
		ses.client = &http.Client{}
	}

	resp, err := ses.client.Do(&req)
	if err != nil {
		return err
	}
	if resp.StatusCode > 204 {
		defer resp.Body.Close()
		return buildError(resp)
	}

	return nil
}

func buildError(r *http.Response) *SESError {
	err := SESError{}
	xml.NewDecoder(r.Body).Decode(&err)
	return &err
}
