// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package a

import "a/model"

// Valid: First argument matches function name
func CreateUser() error {
	return model.NewAppError("CreateUser", "error.message", nil, "", 500)
}

func UpdateProfile() error {
	err := model.NewAppError("UpdateProfile", "error.message", nil, "", 500)
	return err
}

func DeleteAccount() error {
	// Multiple calls with correct names
	if err := model.NewAppError("DeleteAccount", "error1", nil, "", 500); err != nil {
		return err
	}
	return model.NewAppError("DeleteAccount", "error2", nil, "", 400)
}

// Invalid: First argument doesn't match function name
func SaveData() error {
	return model.NewAppError("WrongName", "error.message", nil, "", 500) // want "The first NewAppError parameter must be the name of the function"
}

func ProcessRequest() error {
	err := model.NewAppError("DifferentFunction", "error.message", nil, "", 500) // want "The first NewAppError parameter must be the name of the function"
	return err
}

func HandleSubmit() error {
	// One correct, one wrong
	if true {
		model.NewAppError("HandleSubmit", "error1", nil, "", 500)
	}
	return model.NewAppError("handleSubmit", "error2", nil, "", 400) // want "The first NewAppError parameter must be the name of the function"
}

// Edge cases
func EmptyFunction() error {
	// Empty function name would be caught but we test with wrong name
	return model.NewAppError("", "error.message", nil, "", 500) // want "The first NewAppError parameter must be the name of the function"
}
