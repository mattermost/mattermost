// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mailservice

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	INBUCKET_API = "/api/v1/mailbox/"
)

// OutputJSONHeader holds the received Header to test sending emails (inbucket)
type JSONMessageHeaderInbucket []struct {
	Mailbox             string
	ID                  string `json:"Id"`
	From, Subject, Date string
	To                  []string
	Size                int
}

// OutputJSONMessage holds the received Message fto test sending emails (inbucket)
type JSONMessageInbucket struct {
	Mailbox             string
	ID                  string `json:"Id"`
	From, Subject, Date string
	Size                int
	Header              map[string][]string
	Body                struct {
		Text string
		HTML string `json:"Html"`
	}
	Attachments []struct {
		Filename     string
		ContentType  string `json:"content-type"`
		DownloadLink string `json:"download-link"`
		Bytes        []byte `json:"-"`
	}
}

func ParseEmail(email string) string {
	pos := strings.Index(email, "@")
	parsedEmail := email[0:pos]
	return parsedEmail
}

func GetMailBox(email string) (results JSONMessageHeaderInbucket, err error) {

	parsedEmail := ParseEmail(email)

	url := fmt.Sprintf("%s%s%s", getInbucketHost(), INBUCKET_API, parsedEmail)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.Body == nil {
		return nil, fmt.Errorf("No Mailbox")
	}

	var record JSONMessageHeaderInbucket
	err = json.NewDecoder(resp.Body).Decode(&record)
	switch {
	case err == io.EOF:
		return nil, fmt.Errorf("Error: %s", err)
	case err != nil:
		return nil, fmt.Errorf("Error: %s", err)
	}
	if len(record) == 0 {
		return nil, fmt.Errorf("No mailbox")
	}

	return record, nil
}

func GetMessageFromMailbox(email, id string) (results JSONMessageInbucket, err error) {

	parsedEmail := ParseEmail(email)

	var record JSONMessageInbucket

	url := fmt.Sprintf("%s%s%s/%s", getInbucketHost(), INBUCKET_API, parsedEmail, id)
	emailResponse, err := get(url)
	if err != nil {
		return record, err
	}
	defer emailResponse.Body.Close()

	err = json.NewDecoder(emailResponse.Body).Decode(&record)

	// download attachments
	if record.Attachments != nil && len(record.Attachments) > 0 {
		for i := range record.Attachments {
			if bytes, err := downloadAttachment(record.Attachments[i].DownloadLink); err != nil {
				return record, err
			} else {
				record.Attachments[i].Bytes = make([]byte, len(bytes))
				copy(record.Attachments[i].Bytes, bytes)
			}
		}
	}

	return record, err
}

func downloadAttachment(url string) ([]byte, error) {
	attachmentResponse, err := get(url)
	if err != nil {
		return nil, err
	}
	defer attachmentResponse.Body.Close()

	buf := new(bytes.Buffer)
	io.Copy(buf, attachmentResponse.Body)
	return buf.Bytes(), nil
}

func get(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func DeleteMailBox(email string) (err error) {

	parsedEmail := ParseEmail(email)

	url := fmt.Sprintf("%s%s%s", getInbucketHost(), INBUCKET_API, parsedEmail)
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func RetryInbucket(attempts int, callback func() error) (err error) {
	for i := 0; ; i++ {
		err = callback()
		if err == nil {
			return nil
		}

		if i >= (attempts - 1) {
			break
		}

		time.Sleep(5 * time.Second)

		fmt.Println("retrying...")
	}
	return fmt.Errorf("After %d attempts, last error: %s", attempts, err)
}

func getInbucketHost() (host string) {

	inbucket_host := os.Getenv("CI_HOST")
	if inbucket_host == "" {
		inbucket_host = "dockerhost"
	}

	inbucket_port := os.Getenv("CI_INBUCKET_PORT")
	if inbucket_port == "" {
		inbucket_port = "9000"
	}
	return fmt.Sprintf("http://%s:%s", inbucket_host, inbucket_port)
}
