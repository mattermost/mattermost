package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const (
	INBUCKET_HOST = "http://dockerhost:9000"
	INBUCKET_API  = "/api/v1/mailbox/"
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
}

func ParseEmail(email string) string {
	pos := strings.Index(email, "@")
	parsedEmail := email[0:pos]
	return parsedEmail
}

func GetMailBox(email string) (results JSONMessageHeaderInbucket, err error) {

	parsedEmail := ParseEmail(email)

	url := fmt.Sprintf("%s%s%s", INBUCKET_HOST, INBUCKET_API, parsedEmail)
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

	var record JSONMessageHeaderInbucket
	if err := json.NewDecoder(resp.Body).Decode(&record); err != nil {
		fmt.Println(err)
		return nil, err
	}
	return record, nil
}

func GetMessageFromMailbox(email, id string) (results JSONMessageInbucket, err error) {

	parsedEmail := ParseEmail(email)

	var record JSONMessageInbucket

	url := fmt.Sprintf("%s%s%s/%s", INBUCKET_HOST, INBUCKET_API, parsedEmail, id)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return record, err
	}

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return record, err
	}
	defer resp.Body.Close()

	if err := json.NewDecoder(resp.Body).Decode(&record); err != nil {
		fmt.Println(err)
		return record, err
	}
	return record, nil
}

func DeleteMailBox(email string) (err error) {

	parsedEmail := ParseEmail(email)

	url := fmt.Sprintf("%s%s%s", INBUCKET_HOST, INBUCKET_API, parsedEmail)
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
