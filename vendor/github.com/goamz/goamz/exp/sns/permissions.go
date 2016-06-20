package sns

import (
	"strconv"
)

type Permission struct {
	ActionName string
	AccountId  string
}

type AddPermissionResponse struct {
	ResponseMetadata
}

// AddPermission
//
// See http://goo.gl/mbY4a for more details.
func (sns *SNS) AddPermission(permissions []Permission, Label, TopicArn string) (resp *AddPermissionResponse, err error) {
	resp = &AddPermissionResponse{}
	params := makeParams("AddPermission")

	for i, p := range permissions {
		params["AWSAccountId.member."+strconv.Itoa(i+1)] = p.AccountId
		params["ActionName.member."+strconv.Itoa(i+1)] = p.ActionName
	}

	params["Label"] = Label
	params["TopicArn"] = TopicArn

	err = sns.query(params, resp)
	return
}

type RemovePermissionResponse struct {
	ResponseMetadata
}

// RemovePermission
//
// See http://goo.gl/wGl5j for more details.
func (sns *SNS) RemovePermission(Label, TopicArn string) (resp *RemovePermissionResponse, err error) {
	resp = &RemovePermissionResponse{}
	params := makeParams("RemovePermission")

	params["Label"] = Label
	params["TopicArn"] = TopicArn

	err = sns.query(params, resp)
	return
}
