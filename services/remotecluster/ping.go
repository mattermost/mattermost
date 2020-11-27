// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

// pingLoop periodically sends a ping to all remote clusters.
func (rcs *RemoteClusterService) pingLoop(done <-chan struct{}) {
	pingChan := make(chan *model.RemoteCluster, MaxConcurrentSends*2)

	// create a thread pool to send pings concurrently to remotes.
	for i := 0; i < MaxConcurrentSends; i++ {
		go rcs.pingEmitter(pingChan, done)
	}

	go rcs.pingGenerator(pingChan, done)
}

func (rcs *RemoteClusterService) pingGenerator(pingChan chan *model.RemoteCluster, done <-chan struct{}) {
	defer close(pingChan)

	const freq = time.Millisecond * PingFreqMillis

	for {
		start := time.Now()

		// get all remotes, including any previously offline.
		remotes, err := rcs.server.GetStore().RemoteCluster().GetAll(true)
		if err != nil {
			rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Ping remote cluster failed (could not get list of remotes)", mlog.Err(err))
			select {
			case <-time.After(freq):
				continue
			case <-done:
				return
			}
		}

		for _, rc := range remotes {
			pingChan <- rc
		}

		// try to maintain frequency
		elapsed := time.Since(start)
		sleep := time.Second * 1
		if elapsed > freq {
			sleep = time.Until(start.Add(freq))
		}

		select {
		case <-time.After(sleep):
		case <-done:
			return
		}
	}
}

// pingEmitter pulls Remotes from the ping queue (pingChan) and pings them.
// Pinging a remote cannot take longer than PingTimeoutMillis.
func (rcs *RemoteClusterService) pingEmitter(pingChan <-chan *model.RemoteCluster, done <-chan struct{}) {
	for {
		select {
		case rc := <-pingChan:
			if rc != nil {
				if err := rcs.pingRemote(rc); err != nil {
					rcs.server.GetLogger().Log(mlog.LvlRemoteClusterServiceError, "Remote Cluster ping FAILED", mlog.Err(err))
				}
			}
		case <-done:
			return
		}
	}
}

func (rcs *RemoteClusterService) pingRemote(rc *model.RemoteCluster) error {
	frame, err := makePingFrame(rc)
	if err != nil {
		return err
	}
	url := fmt.Sprintf("%s/%s", rc.SiteURL, PingURL)

	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*PingTimeoutMillis)
	defer cancel()

	return rcs.sendFrameToRemote(ctx, frame, url)
}

func makePingFrame(rc *model.RemoteCluster) (*model.RemoteClusterFrame, error) {
	ping := model.RemoteClusterPing{
		SentAt: model.GetMillis(),
	}
	pingRaw, err := json.Marshal(ping)
	if err != nil {
		return nil, err
	}

	msg := &model.RemoteClusterMsg{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Payload:  pingRaw,
	}

	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Token:    rc.RemoteToken,
		Msg:      msg,
	}
	return frame, nil
}
