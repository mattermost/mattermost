// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

func (ps *PlatformService) GetWSQueues(userID, connectionID string, seqNum int64) (*model.WSQueues, error) {
	hub := ps.GetHubForUserId(userID)
	if hub == nil {
		return nil, nil
	}
	connRes := hub.CheckConn(userID, connectionID)
	if connRes == nil {
		return nil, nil
	}
	aq := connRes.ActiveQueue
	dq := connRes.DeadQueue
	dqPtr := connRes.DeadQueuePointer

	// Nothing was written on this server. Early return.
	if dq[0] == nil {
		return nil, nil
	}

	// If seq-1 == last value in the dq.
	if perfectMatch := !_hasMsgLoss(dq, dqPtr, seqNum); perfectMatch {
		aqSlice, err := ps.getAQ(aq, connectionID, userID)
		defer close(aq)
		if err != nil {
			return nil, fmt.Errorf("failed to get from active queue: %w", err)
		}
		// send only aq
		return &model.WSQueues{
			ActiveQ:    aqSlice,
			ReuseCount: connRes.ReuseCount,
		}, nil
	}

	// If seq is there somewhere else in the dq.
	if ok, index := _isInDeadQueue(dq, seqNum); ok {
		aqSlice, err := ps.getAQ(aq, connectionID, userID)
		defer close(aq)
		if err != nil {
			return nil, fmt.Errorf("failed to get from active queue: %w", err)
		}
		dqSlice, err := ps.getDQ(dq, index, dqPtr)
		if err != nil {
			return nil, fmt.Errorf("failed to get from dead queue: %w", err)
		}
		// send aq + drainedDq.
		return &model.WSQueues{
			ActiveQ:    aqSlice,
			DeadQ:      dqSlice,
			ReuseCount: connRes.ReuseCount,
		}, nil
	}

	// Nothing matched.
	return nil, nil
}

func (ps *PlatformService) getAQ(aq <-chan model.WebSocketMessage, connID, userID string) ([]model.ActiveQueueItem, error) {
	aqSlice := make([]model.ActiveQueueItem, 0)
	for {
		select {
		case msg := <-aq:
			evtType := model.WebSocketMsgTypeResponse
			_, evtOk := msg.(*model.WebSocketEvent)
			if evtOk {
				evtType = model.WebSocketMsgTypeEvent
			}
			buf, err := msg.ToJSON()
			if err != nil {
				return nil, fmt.Errorf("failed to marshal websocket event: %w, connection_id=%s, user_id=%s", err, connID, userID)
			}
			aqSlice = append(aqSlice, model.ActiveQueueItem{
				Buf:  buf,
				Type: evtType,
			})
		default:
			// read until there's nothing to read.
			return aqSlice, nil
		}
	}
}

// getDQ is the same as drainDeadQueue, except it writes to a byte slice
// instead of the network. To be refactored into a single method.
func (ps *PlatformService) getDQ(dq []*model.WebSocketEvent, index, dqPtr int) ([][]byte, error) {
	if dq[0] == nil {
		return nil, nil
	}

	dqSlice := make([][]byte, 0)
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	// This means pointer hasn't rolled over.
	if dq[dqPtr] == nil {
		// Clear till the end of queue.
		for i := index; i < dqPtr; i++ {
			buf.Reset()
			err := dq[i].Encode(enc, &buf)
			if err != nil {
				return nil, fmt.Errorf("error in encoding websocket message in dead queue: %w", err)
			}
			dqSlice = append(dqSlice, buf.Bytes())
		}
		return dqSlice, nil
	}

	// We go on until next sequence number is smaller than previous one.
	// Which means it has rolled over.
	currPtr := index
	for {
		buf.Reset()
		err := dq[currPtr].Encode(enc, &buf)
		if err != nil {
			return nil, fmt.Errorf("error in encoding websocket message in dead queue: %w", err)
		}
		oldSeq := dq[currPtr].GetSequence()
		currPtr = (currPtr + 1) % deadQueueSize
		newSeq := dq[currPtr].GetSequence()
		if oldSeq > newSeq {
			break
		}
	}
	return dqSlice, nil
}
