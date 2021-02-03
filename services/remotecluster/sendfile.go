// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
)

type SendFileResultFunc func(us *model.UploadSession, rc *model.RemoteCluster, resp *Response, err error)

type sendFileTask struct {
	rc *model.RemoteCluster
	us *model.UploadSession
	rp ReaderProvider
	f  SendFileResultFunc
}

type ReaderProvider interface {
	FileReader(path string) (filesstore.ReadCloseSeeker, *model.AppError)
}

// SendFile asynchronously sends a file to a remote cluster.
//
// `ctx` determines behaviour when the outbound queue is full. A timeout or deadline context will return a
// BufferFullError if the file cannot be enqueued before the timeout. A background context will block indefinitely.
//
// Nil or error return indicates success or failure of file enqueue only.
//
// An optional callback can be provided that receives the response from the remote cluster. The `err` provided to the
// callback is regarding file delivery only. The `resp` contains the decoded bytes returned from the remote.
// If a callback is provided it should return quickly.
func (rcs *Service) SendFile(ctx context.Context, us *model.UploadSession, rc *model.RemoteCluster, rp ReaderProvider, f SendFileResultFunc) error {
	if ctx == nil {
		ctx = context.Background()
	}

	task := sendFileTask{
		rc: rc,
		us: us,
		rp: rp,
		f:  f,
	}

	// task is placed in the channel corresponding to the remoteId.
	h := hash(rc.RemoteId)
	idx := h % uint32(len(rcs.sendFiles))

	select {
	case rcs.sendFiles[idx] <- task:
		return nil
	case <-ctx.Done():
		return NewBufferFullError(cap(rcs.send))
	}
}

func hash(s string) uint32 {
	h := fnv.New32a()
	h.Write([]byte(s))
	return h.Sum32()
}

// sendFileLoop is called by each goroutine created for the send file pool and waits for
// sendFileTask's until the done channel is signalled.
//
// Each goroutine in the pool is assigned a specific channel, and tasks are placed in the
// channel cooresponding to the remoteId.
func (rcs *Service) sendFileLoop(chanNum int, done chan struct{}) {
	for {
		select {
		case task := <-rcs.sendFiles[chanNum]:
			rcs.sendFile(task)
		case <-done:
			return
		}
	}
}

func (rcs *Service) sendFile(task sendFileTask) {
	// Ensure a panic from the callback does not exit the thread.
	defer func() {
		if r := recover(); r != nil {
			rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Remote Cluster sendFile panic",
				mlog.String("remote", task.rc.DisplayName),
				mlog.String("uploadId", task.us.Id),
				mlog.Any("panic", r),
			)
		}
	}()

	fi, err := rcs.sendFileToRemote(SendTimeout, task.us, task.rc, task.rp)
	var response Response

	if err != nil {
		rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Remote Cluster send file failed",
			mlog.String("remote", task.rc.DisplayName),
			mlog.String("uploadId", task.us.Id),
			mlog.Err(err),
		)
		response.Status = ResponseStatusFail
		response.Err = err.Error()
	} else {
		rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceDebug, "Remote Cluster file sent successfully",
			mlog.String("remote", task.rc.DisplayName),
			mlog.String("uploadId", task.us.Id),
		)
		response.Status = ResponseStatusOK
		response.SetPayload(fi)
	}

	// If callback provided then call it with the results.
	if task.f != nil {
		task.f(task.us, task.rc, &response, err)
	}
}

func (rcs *Service) sendFileToRemote(timeout time.Duration, us *model.UploadSession, rc *model.RemoteCluster, rp ReaderProvider) (*model.FileInfo, error) {
	r, appErr := rp.FileReader(us.Path) // get Reader for the file
	if appErr != nil {
		return nil, fmt.Errorf("error opening file while sending to remote %s: %w", rc.RemoteId, appErr)
	}
	defer r.Close()

	url := fmt.Sprintf("%s/%s/uploads/%s", rc.SiteURL, model.API_URL_SUFFIX, us.Id)

	req, err := http.NewRequest("POST", url, r)
	if err != nil {
		return nil, err
	}

	req.Header.Set(model.HEADER_AUTH, model.HEADER_BEARER+" "+rc.RemoteToken)

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	resp, err := rcs.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected response: %d - %s", resp.StatusCode, resp.Status)
	}

	// body should be a FileInfo
	var fi model.FileInfo
	if err := json.Unmarshal(body, &fi); err != nil {
		return nil, fmt.Errorf("unexpected response body: %w", err)
	}

	return &fi, nil
}
