// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
)

// postsToAttachments returns the file attachments for a slice of posts that need to be synchronized.
func (scs *Service) postsToAttachments(posts []*model.Post, rc *model.RemoteCluster, lastSyncAt int64) []*model.FileInfo {
	infos := make([]*model.FileInfo, 0)

	for _, post := range posts {
		fis, err := scs.server.GetStore().FileInfo().GetForPost(post.Id, false, true, true)
		if err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "could not get file info for attachment",
				mlog.String("post_id", post.Id),
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(err),
			)
			continue
		}

		for _, fi := range fis {
			if scs.shouldSyncAttachment(fi, rc, lastSyncAt) {
				infos = append(infos, fi)
			}
		}
	}
	return infos
}

// postsToAttachments returns the file attachments for a slice of posts that need to be synchronized.
func (scs *Service) shouldSyncAttachment(fi *model.FileInfo, rc *model.RemoteCluster, lastSyncAt int64) bool {
	sca, err := scs.server.GetStore().SharedChannel().GetAttachment(fi.Id, rc.RemoteId)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "error fetching shared channel attachment",
				mlog.String("file_id", fi.Id),
				mlog.String("remote_id", rc.RemoteId),
				mlog.Err(err),
			)
		}
		// no record so sync is needed
		return true
	}

	if sca.LastSyncAt < fi.UpdateAt {
		return true
	}

	return false
}

// syncAttachmentForRemote synchronously sends a file attachment to a remote cluster.
func (scs *Service) syncAttachmentForRemote(fi *model.FileInfo, post *model.Post, rc *model.RemoteCluster, retries int) (*model.FileInfo, error) {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return nil, fmt.Errorf("cannot update remote cluster for remote id %s; Remote Cluster Service not enabled", rc.RemoteId)
	}

	us := &model.UploadSession{
		Type:      model.UploadTypeAttachment,
		UserId:    post.UserId,
		ChannelId: post.ChannelId,
		Filename:  fi.Name,
		FileSize:  fi.Size,
		RemoteId:  rc.RemoteId,
		ReqFileId: fi.Id,
	}

	payload, err := json.Marshal(us)
	if err != nil {
		return nil, err
	}

	msg := model.NewRemoteClusterMsg(TopicUploadCreate, payload)

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	var usResp model.UploadSession
	var respErr error
	wg := &sync.WaitGroup{}

	err = rcs.SendMsg(ctx, msg, rc, func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp remotecluster.Response, err error) {
		defer wg.Done()
		if err != nil || !resp.IsSuccess() {
			respErr = err
			return
		}
		respErr = json.Unmarshal(resp.Payload, &usResp)
	})

	if err != nil {
		return nil, fmt.Errorf("error sending create upload session to remote %s for post %s: %w", rc.RemoteId, post.Id, err)
	}

	wg.Wait()

	if respErr != nil {
		return nil, fmt.Errorf("invalid create upload session response for remote %s and post %s: %w", rc.RemoteId, post.Id, respErr)
	}

	r, err := scs.app.FileReader(usResp.Path)
	if err != nil {
		return nil, fmt.Errorf("error opening file for sync; remote %s and post %s : %w", rc.RemoteId, post.Id, respErr)
	}

	return rcs.SendFile(&usResp, r, retries)
}

// onReceiveUploadCreate is called when a message requesting to create an upload session is received.  An upload session is
// created and the id returned in the response.
func (scs *Service) onReceiveUploadCreate(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response remotecluster.Response) error {

	var us *model.UploadSession

	if err := json.Unmarshal(msg.Payload, us); err != nil {
		return fmt.Errorf("invalid upload session request: %w", err)
	}

	// make sure channel is shared for the remote sender
	if _, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(us.ChannelId, rc.RemoteId); err != nil {
		return fmt.Errorf("could not validate upload session for remote: %w", err)
	}

	us.RemoteId = rc.RemoteId // don't let remotes try to impersonate each other

	// create upload session.
	usSaved, appErr := scs.app.CreateUploadSession(us)
	if appErr != nil {
		return appErr
	}

	response.SetPayload(usSaved)
	return nil
}
