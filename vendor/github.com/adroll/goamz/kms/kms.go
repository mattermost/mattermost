//
// gokms - Go packages to interact with Amazon KMS (Key Management Service)
//
//
// Written by Kiko Hsieh <kiko_hsieh@trend.com.tw>
//
package kms

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/AdRoll/goamz/aws"
	"io/ioutil"
	"net/http"
	"time"
)

const (
	httpMethod   = "POST"
	contentType  = "application/x-amz-json-1.1"
	targetPrefix = "TrentService."
	serverName   = "kms"
)

type KMS struct {
	aws.Auth
	aws.Region
}

func New(auth aws.Auth, region aws.Region) *KMS {
	return &KMS{auth, region}
}

func (k *KMS) query(requstInfo KMSAction) ([]byte, error) {
	b, err := json.Marshal(requstInfo)
	if err != nil {
		return nil, err
	}

	hreq, err := http.NewRequest(httpMethod, k.Region.KMSEndpoint+"/", bytes.NewBuffer(b))
	if err != nil {
		return nil, err
	}

	hreq.Header.Set("Content-Type", contentType)
	hreq.Header.Set("X-Amz-Date", time.Now().UTC().Format(aws.ISO8601BasicFormat))
	hreq.Header.Set("X-Amz-Target", targetPrefix+requstInfo.ActionName())

	if k.Auth.Token() != "" {
		hreq.Header.Set("X-Amz-Security-Token", k.Auth.Token())
	}

	//All KMS operations require Signature Version 4
	//http://docs.aws.amazon.com/kms/latest/APIReference/Welcome.html
	signer := aws.NewV4Signer(k.Auth, serverName, k.Region)
	signer.Sign(hreq)

	r, err := http.DefaultClient.Do(hreq)

	if err != nil {
		return nil, err
	}

	body, _ := ioutil.ReadAll(r.Body)

	defer r.Body.Close()

	if r.StatusCode != 200 {
		return nil, buildError(body, r.StatusCode)
	}

	return body, err
}

type KMSError struct {
	StatusCode int    `json:",omitempty"`
	Type       string `json:"__type"`
	Message    string `json:"message"`
}

func (k *KMSError) Error() string {
	return fmt.Sprintf("Type: %s, Code: %d, Message: %s",
		k.Type, k.StatusCode, k.Message,
	)

}

func buildError(body []byte, statusCode int) error {
	err := KMSError{StatusCode: statusCode}
	json.Unmarshal(body, &err)
	return &err
}

// ================== Action ========================

func (k *KMS) DescribeKey(info DescribeKeyInfo) (DescribeKeyResp, error) {
	resp := DescribeKeyResp{}
	bResp, err := k.query(&info)

	if err != nil {
		return resp, err
	}

	err = json.Unmarshal(bResp, &resp)

	return resp, err
}

func (k *KMS) ListAliases(info ListAliasesInfo) (ListAliasesResp, error) {
	resp := ListAliasesResp{}
	bResp, err := k.query(&info)

	if err != nil {
		return resp, err
	}

	err = json.Unmarshal(bResp, &resp)

	return resp, err
}

func (k *KMS) Encrypt(info EncryptInfo) (EncryptResp, error) {
	resp := EncryptResp{}
	bResp, err := k.query(&info)

	if err != nil {
		return resp, err
	}

	err = json.Unmarshal(bResp, &resp)

	return resp, err
}

func (k *KMS) Decrypt(info DecryptInfo) (DecryptResp, error) {
	resp := DecryptResp{}
	bResp, err := k.query(&info)

	if err != nil {
		return resp, err
	}

	err = json.Unmarshal(bResp, &resp)

	return resp, err
}

func (k *KMS) EnableKey(info EnableKeyInfo) error {
	_, err := k.query(&info)

	return err
}

func (k *KMS) DisableKey(info DisableKeyInfo) error {
	_, err := k.query(&info)

	return err
}
