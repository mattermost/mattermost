// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package upgrader

import (
	"fmt"
)

// InvalidArch indicates that the current operating system or cpu architecture doesn't support upgrades
type InvalidArch struct{}

func NewInvalidArch() *InvalidArch {
	return &InvalidArch{}
}

func (e *InvalidArch) Error() string {
	return "invalid operating system or processor architecture"
}

// InvalidSignature indicates that the downloaded file doesn't have a valid signature.
type InvalidSignature struct{}

func NewInvalidSignature() *InvalidSignature {
	return &InvalidSignature{}
}

func (e *InvalidSignature) Error() string {
	return "invalid file signature"
}

// InvalidPermissions indicates that the file permissions doesn't allow to upgrade
type InvalidPermissions struct {
	ErrType            string
	Path               string
	FileUsername       string
	MattermostUsername string
}

func NewInvalidPermissions(errType string, path string, mattermostUsername string, fileUsername string) *InvalidPermissions {
	return &InvalidPermissions{
		ErrType:            errType,
		Path:               path,
		FileUsername:       fileUsername,
		MattermostUsername: mattermostUsername,
	}
}

func (e *InvalidPermissions) Error() string {
	return fmt.Sprintf("the user %s is unable to update the %s file", e.MattermostUsername, e.Path)
}
