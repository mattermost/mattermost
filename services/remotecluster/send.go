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

	"github.com/mattermost/mattermost-server/v5/model"
)

type SendResultFunc func(msg *model.RemoteClusterMsg, remote *model.RemoteCluster, err error)

type sendTask struct {
	msg *model.RemoteClusterMsg
	f   SendResultFunc
}

type result struct {
	task   sendTask
	remote *model.RemoteCluster
	err    error
}

var (
	sendProtocol string // override for testing
)

func init() {
	sendProtocol = "https"
	insecure := os.Getenv(EnvInsecureOverrideKey)
	if insecure == "TRUE" || insecure == "1" || insecure == "Y" || insecure == "YES" {
		sendProtocol = "http"
	}
}

// SendOutgoingMsg sends a message to all remote clusters interested in the message's topic.
//
// `ctx` determines behaviour when the outbound queue is full. A timeout or deadline context will return a
// BufferFullError if the message cannot be enqueued before the timeout. A background context will block indefinitely.
//
// An optional callback can be provided that receives the success or fail result of sending to each remote cluster.
// Success or fail is regarding message delivery only.  If a callback is provided it should return quickly.
func (rcs *RemoteClusterService) SendOutgoingMsg(ctx context.Context, msg *model.RemoteClusterMsg, f SendResultFunc) error {
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

func (rcs *RemoteClusterService) sendLoop(done chan struct{}) {
	// start the result callbacks loop, sharing the done chan.
	results := make(chan result, ResultsChanBuffer)
	go rcs.resultLoop(results, done)

	for {
		select {
		case task := <-rcs.send:
			rcs.sendMsg(task)
		case <-done:
			return
		}
	}
}

func (rcs *RemoteClusterService) resultLoop(results chan result, done chan struct{}) {
loop:
	for {
		select {
		case result := <-results:
			if result.task.f != nil {
				result.task.f(result.task.msg, result.remote, result.err)
			}
		case <-done:
			break loop
		}
	}

	// try to drain result queue
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*ResultQueueDrainTimeoutMillis)
	defer cancel()

	for {
		select {
		case result := <-results:
			if result.task.f != nil {
				result.task.f(result.task.msg, result.remote, result.err)
			}
		case <-ctx.Done():
			rcs.server.GetLogger().Error("RemoteClusterService timeout draining result queue.")
			return
		default:
			return
		}
	}
}

func (rcs *RemoteClusterService) sendMsg(task sendTask) {
	// get list of interested remotes.
	list, err := rcs.server.GetStore().RemoteCluster().GetByTopic(task.msg.Topic)
	if err != nil {
		if task.f != nil {
			task.f(task.msg, nil, fmt.Errorf("could not send msg to remote: %w", err))
		}
	}

	// bound the number of concurrent goroutines used to send using a simple semaphore.
	bound := make(chan struct{}, MaxConcurrentSends)

	for _, rc := range list {
		bound <- struct{}{}
		go func(rc *model.RemoteCluster) {
			defer func() { <-bound }()
			err := rcs.sendMsgToRemote(rc, task)
			if task.f != nil {
				task.f(task.msg, rc, err)
			}
		}(rc)
	}
}

func (rcs *RemoteClusterService) sendMsgToRemote(rc *model.RemoteCluster, task sendTask) error {
	buf, err := json.Marshal(task.msg)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s://%s:%d/%s", sendProtocol, rc.Hostname, rc.Port, SendMsgURL)
	resp, err := http.Post(url, "application/json", bytes.NewReader(buf))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected response: %d - %s", resp.StatusCode, resp.Status)
	}
	return nil
}
