// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// PingNow emits a ping immediately without waiting for next ping loop.
func (rcs *Service) PingNow(rc *model.RemoteCluster) {
	online := rc.IsOnline()

	if err := rcs.pingRemote(rc); err != nil {
		rcs.server.Log().Log(mlog.LvlRemoteClusterServiceWarn, "Remote cluster ping failed",
			mlog.String("remote", rc.DisplayName),
			mlog.String("remoteId", rc.RemoteId),
			mlog.String("pluginId", rc.PluginID),
			mlog.Err(err),
		)
	}

	if online != rc.IsOnline() {
		if metrics := rcs.server.GetMetrics(); metrics != nil {
			metrics.IncrementRemoteClusterConnStateChangeCounter(rc.RemoteId, rc.IsOnline())
		}
		rcs.fireConnectionStateChgEvent(rc)
	}
}

// pingLoop periodically sends a ping to all remote clusters.
func (rcs *Service) pingLoop(done <-chan struct{}) {
	pingChan := make(chan *model.RemoteCluster, MaxConcurrentSends*2)

	// create a thread pool to send pings concurrently to remotes.
	for i := 0; i < MaxConcurrentSends; i++ {
		go rcs.pingEmitter(pingChan, done)
	}

	go rcs.pingGenerator(pingChan, done)
}

func (rcs *Service) pingGenerator(pingChan chan *model.RemoteCluster, done <-chan struct{}) {
	defer close(pingChan)

	for {
		pingFreq := rcs.GetPingFreq()
		start := time.Now()

		// get all remotes, including any previously offline.
		remotes, err := rcs.server.GetStore().RemoteCluster().GetAll(model.RemoteClusterQueryFilter{})
		if err != nil {
			rcs.server.Log().Log(mlog.LvlRemoteClusterServiceError, "Ping remote cluster failed (could not get list of remotes)", mlog.Err(err))
			select {
			case <-time.After(pingFreq):
				continue
			case <-done:
				return
			}
		}

		for _, rc := range remotes {
			// filter out unconfirmed invites so we don't ping them without permission
			if rc.IsConfirmed() {
				pingChan <- rc
			}
		}

		// try to maintain frequency
		elapsed := time.Since(start)
		if elapsed < pingFreq {
			sleep := time.Until(start.Add(pingFreq))
			select {
			case <-time.After(sleep):
			case <-done:
				return
			}
		}
	}
}

// pingEmitter pulls Remotes from the ping queue (pingChan) and pings them.
// Pinging a remote cannot take longer than PingTimeoutMillis.
func (rcs *Service) pingEmitter(pingChan <-chan *model.RemoteCluster, done <-chan struct{}) {
	for {
		select {
		case rc := <-pingChan:
			if rc == nil {
				return
			}
			rcs.PingNow(rc)
		case <-done:
			return
		}
	}
}

var ErrPluginPingFail = errors.New("plugin ping failed")

// pingRemote make a synchronous ping to a remote cluster. Return is error if ping is
// unsuccessful and nil on success.
func (rcs *Service) pingRemote(rc *model.RemoteCluster) error {
	ping := model.RemoteClusterPing{}

	if rc.IsPlugin() {
		ping.SentAt = model.GetMillis()
		if ok := rcs.app.OnSharedChannelsPing(rc); !ok {
			return ErrPluginPingFail
		}
		ping.RecvAt = model.GetMillis()
	} else {
		frame, err := makePingFrame(rc)
		if err != nil {
			return err
		}
		url := fmt.Sprintf("%s/%s", rc.SiteURL, PingURL)

		resp, err := rcs.sendFrameToRemote(PingTimeout, rc, frame, url)
		if err != nil {
			return err
		}
		rc.LastPingAt = model.GetMillis()

		err = json.Unmarshal(resp, &ping)
		if err != nil {
			return err
		}
	}

	if err := rcs.server.GetStore().RemoteCluster().SetLastPingAt(rc.RemoteId); err != nil {
		rcs.server.Log().Log(mlog.LvlRemoteClusterServiceError, "Failed to update LastPingAt for remote cluster",
			mlog.String("remote", rc.DisplayName),
			mlog.String("remoteId", rc.RemoteId),
			mlog.Err(err),
		)
	}

	if metrics := rcs.server.GetMetrics(); metrics != nil {
		sentAt := time.Unix(0, ping.SentAt*int64(time.Millisecond))
		elapsed := time.Since(sentAt).Seconds()
		metrics.ObserveRemoteClusterPingDuration(rc.RemoteId, elapsed)

		// we approximate clock skew between remotes.
		skew := elapsed/2 - float64(ping.RecvAt-ping.SentAt)/1000
		metrics.ObserveRemoteClusterClockSkew(rc.RemoteId, skew)
	}

	rcs.server.Log().Log(mlog.LvlRemoteClusterServiceDebug, "Remote cluster ping",
		mlog.String("remote", rc.DisplayName),
		mlog.String("remoteId", rc.RemoteId),
		mlog.String("pluginId", rc.PluginID),
		mlog.Int("SentAt", ping.SentAt),
		mlog.Int("RecvAt", ping.RecvAt),
		mlog.Int("Diff", ping.RecvAt-ping.SentAt),
	)
	return nil
}

func makePingFrame(rc *model.RemoteCluster) (*model.RemoteClusterFrame, error) {
	ping := model.RemoteClusterPing{
		SentAt: model.GetMillis(),
	}
	pingRaw, err := json.Marshal(ping)
	if err != nil {
		return nil, err
	}

	msg := model.NewRemoteClusterMsg(PingTopic, pingRaw)

	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Msg:      msg,
	}
	return frame, nil
}

func (rcs *Service) fireConnectionStateChgEvent(rc *model.RemoteCluster) {
	rcs.mux.RLock()
	listeners := make([]ConnectionStateListener, 0, len(rcs.connectionStateListeners))
	for _, l := range rcs.connectionStateListeners {
		listeners = append(listeners, l)
	}
	rcs.mux.RUnlock()

	for _, l := range listeners {
		l(rc, rc.IsOnline())
	}
}
