// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

type SendResultFunc func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response, err error)

type sendTask struct {
	rc  *model.RemoteCluster
	msg model.RemoteClusterMsg
	f   SendResultFunc
}

// BroadcastMsg asynchronously sends a message to all remote clusters interested in the message's topic.
//
// `ctx` determines behaviour when the outbound queue is full. A timeout or deadline context will return a
// BufferFullError if the message cannot be enqueued before the timeout. A background context will block indefinitely.
//
// An optional callback can be provided that receives the success or fail result of sending to each remote cluster.
// Success or fail is regarding message delivery only.  If a callback is provided it should return quickly.
func (rcs *Service) BroadcastMsg(ctx context.Context, msg model.RemoteClusterMsg, f SendResultFunc) error {
	// get list of interested remotes.
	filter := model.RemoteClusterQueryFilter{
		Topic: msg.Topic,
	}
	list, err := rcs.server.GetStore().RemoteCluster().GetAll(filter)
	if err != nil {
		return err
	}

	errs := merror.New()

	for _, rc := range list {
		if err := rcs.SendMsg(ctx, msg, rc, f); err != nil {
			errs.Append(err)
		}
	}
	return errs.ErrorOrNil()
}

// SendMsg asynchronously sends a message to a remote cluster.
//
// `ctx` determines behaviour when the outbound queue is full. A timeout or deadline context will return a
// BufferFullError if the message cannot be enqueued before the timeout. A background context will block indefinitely.
//
// Nil or error return indicates success or failure of message enqueue only.
//
// An optional callback can be provided that receives the response from the remote cluster. The `err` provided to the
// callback is regarding response decoding only. The `resp` contains the decoded bytes returned from the remote.
// If a callback is provided it should return quickly.
func (rcs *Service) SendMsg(ctx context.Context, msg model.RemoteClusterMsg, rc *model.RemoteCluster, f SendResultFunc) error {
	if ctx == nil {
		ctx = context.Background()
	}

	task := sendTask{
		rc:  rc,
		msg: msg,
		f:   f,
	}

	select {
	case rcs.send <- task:
		return nil
	case <-ctx.Done():
		return NewBufferFullError(cap(rcs.send))
	}
}

func (rcs *Service) sendLoop(done chan struct{}) {
	for {
		select {
		case task := <-rcs.send:
			rcs.sendMsg(task)
		case <-done:
			return
		}
	}
}

func (rcs *Service) sendMsg(task sendTask) {
	// Ensure a panic from the callback does not exit the pool thread.
	defer func() {
		if r := recover(); r != nil {
			rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Remote Cluster sendMsg panic",
				mlog.String("remote", task.rc.DisplayName), mlog.String("msgId", task.msg.Id), mlog.Any("panic", r))
		}
	}()

	frame := &model.RemoteClusterFrame{
		RemoteId: task.rc.RemoteId,
		Token:    task.rc.RemoteToken,
		Msg:      task.msg,
	}
	url := fmt.Sprintf("%s/%s", task.rc.SiteURL, SendMsgURL)

	respJSON, err := rcs.sendFrameToRemote(SendTimeout, frame, url)
	var response Response

	if err != nil {
		rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Remote Cluster send message failed",
			mlog.String("remote", task.rc.DisplayName), mlog.String("msgId", task.msg.Id), mlog.Err(err))

		response.Err = err.Error()
	} else {
		rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceDebug, "Remote Cluster message sent successfully",
			mlog.String("remote", task.rc.DisplayName), mlog.String("msgId", task.msg.Id))

		if errDecode := json.Unmarshal(respJSON, &response); errDecode != nil {
			rcs.server.GetLogger().Error("Invalid response sending message to remote cluster", mlog.String("remote", task.rc.DisplayName), mlog.Err(errDecode))
			response.Err = errDecode.Error()
		}
	}

	// If callback provided then call it with the results.
	if task.f != nil {
		task.f(task.msg, task.rc, &response, err)
	}
}

func (rcs *Service) sendFrameToRemote(timeout time.Duration, frame *model.RemoteClusterFrame, url string) ([]byte, error) {
	body, err := json.Marshal(frame)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := rcs.httpClient.Do(req.WithContext(ctx))
	if metrics := rcs.server.GetMetrics(); metrics != nil {
		if err != nil || resp.StatusCode != http.StatusOK {
			metrics.IncrementRemoteClusterMsgErrorsCounter(frame.RemoteId, os.IsTimeout(err))
		} else {
			metrics.IncrementRemoteClusterMsgSentCounter(frame.RemoteId)
		}
	}
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return body, fmt.Errorf("unexpected response: %d - %s", resp.StatusCode, resp.Status)
	}
	return body, nil
}
