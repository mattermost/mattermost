// The iam package provides types and functions for interaction with the AWS
// Identity and Access Management (IAM) service.
package iam

import (
	"encoding/xml"
	"github.com/AdRoll/goamz/aws"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// The IAM type encapsulates operations operations with the IAM endpoint.
type IAM struct {
	aws.Auth
	aws.Region
}

// New creates a new IAM instance.
func New(auth aws.Auth, region aws.Region) *IAM {
	return &IAM{auth, region}
}

func (iam *IAM) query(params map[string]string, resp interface{}) error {
	params["Version"] = "2010-05-08"
	params["Timestamp"] = time.Now().In(time.UTC).Format(time.RFC3339)
	endpoint, err := url.Parse(iam.IAMEndpoint)
	if err != nil {
		return err
	}
	signer, err := aws.NewV2Signer(iam.Auth, aws.ServiceInfo{Endpoint: iam.Region.IAMEndpoint, Signer: aws.V2Signature})
	if err != nil {
		return err
	}
	signer.Sign("GET", "/", params)
	endpoint.RawQuery = multimap(params).Encode()
	r, err := http.Get(endpoint.String())
	if err != nil {
		return err
	}
	defer r.Body.Close()
	if r.StatusCode > 200 {
		return buildError(r)
	}
	return xml.NewDecoder(r.Body).Decode(resp)
}

func (iam *IAM) postQuery(params map[string]string, resp interface{}) error {
	endpoint, err := url.Parse(iam.IAMEndpoint)
	if err != nil {
		return err
	}
	params["Version"] = "2010-05-08"
	params["Timestamp"] = time.Now().In(time.UTC).Format(time.RFC3339)
	signer, err := aws.NewV2Signer(iam.Auth, aws.ServiceInfo{Endpoint: iam.Region.IAMEndpoint, Signer: aws.V2Signature})
	if err != nil {
		return err
	}
	signer.Sign("POST", "/", params)
	encoded := multimap(params).Encode()
	body := strings.NewReader(encoded)
	req, err := http.NewRequest("POST", endpoint.String(), body)
	if err != nil {
		return err
	}
	req.Header.Set("Host", endpoint.Host)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Content-Length", strconv.Itoa(len(encoded)))
	r, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer r.Body.Close()
	if r.StatusCode > 200 {
		return buildError(r)
	}
	return xml.NewDecoder(r.Body).Decode(resp)
}

func buildError(r *http.Response) error {
	var (
		err    Error
		errors xmlErrors
	)
	xml.NewDecoder(r.Body).Decode(&errors)
	if len(errors.Errors) > 0 {
		err = errors.Errors[0]
	}
	err.StatusCode = r.StatusCode
	if err.Message == "" {
		err.Message = r.Status
	}
	return &err
}

func multimap(p map[string]string) url.Values {
	q := make(url.Values, len(p))
	for k, v := range p {
		q[k] = []string{v}
	}
	return q
}

// Response to a CreateUser request.
//
// See http://goo.gl/JS9Gz for more details.
type CreateUserResp struct {
	RequestId string `xml:"ResponseMetadata>RequestId"`
	User      User   `xml:"CreateUserResult>User"`
}

// User encapsulates a user managed by IAM.
//
// See http://goo.gl/BwIQ3 for more details.
type User struct {
	Arn  string
	Path string
	Id   string `xml:"UserId"`
	Name string `xml:"UserName"`
}

// CreateUser creates a new user in IAM.
//
// See http://goo.gl/JS9Gz for more details.
func (iam *IAM) CreateUser(name, path string) (*CreateUserResp, error) {
	params := map[string]string{
		"Action":   "CreateUser",
		"Path":     path,
		"UserName": name,
	}
	resp := new(CreateUserResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Response for GetUser requests.
//
// See http://goo.gl/ZnzRN for more details.
type GetUserResp struct {
	RequestId string `xml:"ResponseMetadata>RequestId"`
	User      User   `xml:"GetUserResult>User"`
}

// GetUser gets a user from IAM.
//
// See http://goo.gl/ZnzRN for more details.
func (iam *IAM) GetUser(name string) (*GetUserResp, error) {
	params := map[string]string{
		"Action": "GetUser",
	}
	if name != "" {
		params["UserName"] = name
	}
	resp := new(GetUserResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteUser deletes a user from IAM.
//
// See http://goo.gl/jBuCG for more details.
func (iam *IAM) DeleteUser(name string) (*SimpleResp, error) {
	params := map[string]string{
		"Action":   "DeleteUser",
		"UserName": name,
	}
	resp := new(SimpleResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to a CreateGroup request.
//
// See http://goo.gl/n7NNQ for more details.
type CreateGroupResp struct {
	Group     Group  `xml:"CreateGroupResult>Group"`
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

// Group encapsulates a group managed by IAM.
//
// See http://goo.gl/ae7Vs for more details.
type Group struct {
	Arn  string
	Id   string `xml:"GroupId"`
	Name string `xml:"GroupName"`
	Path string
}

// CreateGroup creates a new group in IAM.
//
// The path parameter can be used to identify which division or part of the
// organization the user belongs to.
//
// If path is unset ("") it defaults to "/".
//
// See http://goo.gl/n7NNQ for more details.
func (iam *IAM) CreateGroup(name string, path string) (*CreateGroupResp, error) {
	params := map[string]string{
		"Action":    "CreateGroup",
		"GroupName": name,
	}
	if path != "" {
		params["Path"] = path
	}
	resp := new(CreateGroupResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to a ListGroups request.
//
// See http://goo.gl/W2TRj for more details.
type GroupsResp struct {
	Groups    []Group `xml:"ListGroupsResult>Groups>member"`
	RequestId string  `xml:"ResponseMetadata>RequestId"`
}

// Groups list the groups that have the specified path prefix.
//
// The parameter pathPrefix is optional. If pathPrefix is "", all groups are
// returned.
//
// See http://goo.gl/W2TRj for more details.
func (iam *IAM) Groups(pathPrefix string) (*GroupsResp, error) {
	params := map[string]string{
		"Action": "ListGroups",
	}
	if pathPrefix != "" {
		params["PathPrefix"] = pathPrefix
	}
	resp := new(GroupsResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteGroup deletes a group from IAM.
//
// See http://goo.gl/d5i2i for more details.
func (iam *IAM) DeleteGroup(name string) (*SimpleResp, error) {
	params := map[string]string{
		"Action":    "DeleteGroup",
		"GroupName": name,
	}
	resp := new(SimpleResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to a CreateAccessKey request.
//
// See http://goo.gl/L46Py for more details.
type CreateAccessKeyResp struct {
	RequestId string    `xml:"ResponseMetadata>RequestId"`
	AccessKey AccessKey `xml:"CreateAccessKeyResult>AccessKey"`
}

// AccessKey encapsulates an access key generated for a user.
//
// See http://goo.gl/LHgZR for more details.
type AccessKey struct {
	UserName string
	Id       string `xml:"AccessKeyId"`
	Secret   string `xml:"SecretAccessKey,omitempty"`
	Status   string
}

// CreateAccessKey creates a new access key in IAM.
//
// See http://goo.gl/L46Py for more details.
func (iam *IAM) CreateAccessKey(userName string) (*CreateAccessKeyResp, error) {
	params := map[string]string{
		"Action":   "CreateAccessKey",
		"UserName": userName,
	}
	resp := new(CreateAccessKeyResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to AccessKeys request.
//
// See http://goo.gl/Vjozx for more details.
type AccessKeysResp struct {
	RequestId  string      `xml:"ResponseMetadata>RequestId"`
	AccessKeys []AccessKey `xml:"ListAccessKeysResult>AccessKeyMetadata>member"`
}

// AccessKeys lists all acccess keys associated with a user.
//
// The userName parameter is optional. If set to "", the userName is determined
// implicitly based on the AWS Access Key ID used to sign the request.
//
// See http://goo.gl/Vjozx for more details.
func (iam *IAM) AccessKeys(userName string) (*AccessKeysResp, error) {
	params := map[string]string{
		"Action": "ListAccessKeys",
	}
	if userName != "" {
		params["UserName"] = userName
	}
	resp := new(AccessKeysResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteAccessKey deletes an access key from IAM.
//
// The userName parameter is optional. If set to "", the userName is determined
// implicitly based on the AWS Access Key ID used to sign the request.
//
// See http://goo.gl/hPGhw for more details.
func (iam *IAM) DeleteAccessKey(id, userName string) (*SimpleResp, error) {
	params := map[string]string{
		"Action":      "DeleteAccessKey",
		"AccessKeyId": id,
	}
	if userName != "" {
		params["UserName"] = userName
	}
	resp := new(SimpleResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// Response to a GetUserPolicy request.
//
// See http://goo.gl/BH04O for more details.
type GetUserPolicyResp struct {
	Policy    UserPolicy `xml:"GetUserPolicyResult"`
	RequestId string     `xml:"ResponseMetadata>RequestId"`
}

// UserPolicy encapsulates an IAM group policy.
//
// See http://goo.gl/C7hgS for more details.
type UserPolicy struct {
	Name     string `xml:"PolicyName"`
	UserName string `xml:"UserName"`
	Document string `xml:"PolicyDocument"`
}

// GetUserPolicy gets a user policy in IAM.
//
// See http://goo.gl/BH04O for more details.
func (iam *IAM) GetUserPolicy(userName, policyName string) (*GetUserPolicyResp, error) {
	params := map[string]string{
		"Action":     "GetUserPolicy",
		"UserName":   userName,
		"PolicyName": policyName,
	}
	resp := new(GetUserPolicyResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
	return nil, nil
}

// PutUserPolicy creates a user policy in IAM.
//
// See http://goo.gl/ldCO8 for more details.
func (iam *IAM) PutUserPolicy(userName, policyName, policyDocument string) (*SimpleResp, error) {
	params := map[string]string{
		"Action":         "PutUserPolicy",
		"UserName":       userName,
		"PolicyName":     policyName,
		"PolicyDocument": policyDocument,
	}
	resp := new(SimpleResp)
	if err := iam.postQuery(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteUserPolicy deletes a user policy from IAM.
//
// See http://goo.gl/7Jncn for more details.
func (iam *IAM) DeleteUserPolicy(userName, policyName string) (*SimpleResp, error) {
	params := map[string]string{
		"Action":     "DeleteUserPolicy",
		"PolicyName": policyName,
		"UserName":   userName,
	}
	resp := new(SimpleResp)
	if err := iam.query(params, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

type SimpleResp struct {
	RequestId string `xml:"ResponseMetadata>RequestId"`
}

type xmlErrors struct {
	Errors []Error `xml:"Error"`
}

// Error encapsulates an IAM error.
type Error struct {
	// HTTP status code of the error.
	StatusCode int

	// AWS code of the error.
	Code string

	// Message explaining the error.
	Message string
}

func (e *Error) Error() string {
	var prefix string
	if e.Code != "" {
		prefix = e.Code + ": "
	}
	if prefix == "" && e.StatusCode > 0 {
		prefix = strconv.Itoa(e.StatusCode) + ": "
	}
	return prefix + e.Message
}
