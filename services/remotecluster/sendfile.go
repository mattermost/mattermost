// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"fmt"
	"io"

	"github.com/mattermost/mattermost-server/v5/model"
)

// TODO
// - create new message type for creating (and fetching) an upload session; send that to remote and get response
// - add a SendFile API to remote cluster service
//		- synchronously send file via rest api
//		- send in a loop that resumes on error
//		- abort after X retries
//		- returns the FileInfo
// - use Remote Cluster Service SendFile API to send file and get FileInfo back
// - record FileInfo details into new ShareChannelAttachment record
//
// - make sure receiving side preserves file id

// SendFile synchronously sends a file to a remote cluster. `retries` determines how many error/resume
// cycles it will try before giving up.
func (rcs *Service) SendFile(us *model.UploadSession, r io.Reader, retries int) (*model.FileInfo, error) {
	return nil, fmt.Errorf("not implemented yet")
}
