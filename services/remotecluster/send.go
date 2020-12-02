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
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

type SendResultFunc func(msg *model.RemoteClusterMsg, remote *model.RemoteCluster, resp []byte, err error)

type sendTask struct {
	msg *model.RemoteClusterMsg
	f   SendResultFunc
}

// SendOutgoingMsg sends a message to all remote clusters interested in the message's topic.
//
// `ctx` determines behaviour when the outbound queue is full. A timeout or deadline context will return a
// BufferFullError if the message cannot be enqueued before the timeout. A background context will block indefinitely.
//
// An optional callback can be provided that receives the success or fail result of sending to each remote cluster.
// Success or fail is regarding message delivery only.  If a callback is provided it should return quickly.
func (rcs *Service) SendOutgoingMsg(ctx context.Context, msg *model.RemoteClusterMsg, f SendResultFunc) error {
	task := sendTask{
		msg: msg,
		f:   f,
	}

	if ctx == nil {
		ctx = context.Background()
	}

	select {
	case rcs.send <- task:
		return nil
	case <-ctx.Done():
		return NewBufferFullError(cap(rcs.send))
	}
}

func (rcs *Service) sendLoop(done chan struct{}) {
	// create thread pool for concurrent message sending.
	for i := 0; i < MaxConcurrentSends; i++ {
		go func() {
			for {
				select {
				case task := <-rcs.send:
					if task.msg != nil {
						rcs.sendMsg(task)
					}
				case <-done:
					return
				}
			}
		}()
	}
}

func (rcs *Service) sendMsg(task sendTask) {
	// get list of interested remotes.
	list, err := rcs.server.GetStore().RemoteCluster().GetByTopic(task.msg.Topic)
	if err != nil {
		if task.f != nil {
			task.f(task.msg, nil, nil, fmt.Errorf("could not send msg to remote: %w", err))
		}
	}

	// bound the number of concurrent goroutines used to send using a semaphore.
	bound := make(chan struct{}, MaxConcurrentSends)

	for _, rc := range list {
		bound <- struct{}{}
		go func(rc *model.RemoteCluster) {
			defer func() { <-bound }()
			resp, err := rcs.sendMsgToRemote(rc, task)
			if task.f != nil {
				task.f(task.msg, rc, resp, err)
			}
			if err != nil {
				rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Remote Cluster message send failed",
					mlog.String("remote", rc.DisplayName), mlog.String("msgId", task.msg.Id), mlog.Err(err))
			} else {
				rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceDebug, "Remote Cluster message sent successfully",
					mlog.String("remote", rc.DisplayName), mlog.String("msgId", task.msg.Id))
			}
		}(rc)
	}
}

func (rcs *Service) sendMsgToRemote(rc *model.RemoteCluster, task sendTask) ([]byte, error) {
	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Token:    rc.RemoteToken,
		Msg:      task.msg,
	}
	url := fmt.Sprintf("%s/%s", rc.SiteURL, SendMsgURL)

	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*SendTimeoutMillis)
	defer cancel()

	return rcs.sendFrameToRemote(ctx, frame, url)
}

func (rcs *Service) sendFrameToRemote(ctx context.Context, frame *model.RemoteClusterFrame, url string) ([]byte, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	body, err := json.Marshal(frame)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req.WithContext(ctx))
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
