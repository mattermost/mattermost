// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"strings"
	"sync"
	"sync/atomic"
)

type ClusterInfo struct {
	Id                 string       `json:"id"`
	Version            string       `json:"version"`
	ConfigHash         string       `json:"config_hash"`
	InterNodeUrl       string       `json:"internode_url"`
	Hostname           string       `json:"hostname"`
	LastSuccessfulPing int64        `json:"last_ping"`
	Alive              int32        `json:"is_alive"`
	Mutex              sync.RWMutex `json:"-"`
}

func (me *ClusterInfo) ToJson() string {
	me.Mutex.RLock()
	defer me.Mutex.RUnlock()
	b, err := json.Marshal(me)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (me *ClusterInfo) Copy() *ClusterInfo {
	json := me.ToJson()
	return ClusterInfoFromJson(strings.NewReader(json))
}

func ClusterInfoFromJson(data io.Reader) *ClusterInfo {
	decoder := json.NewDecoder(data)
	var me ClusterInfo
	me.Mutex = sync.RWMutex{}
	err := decoder.Decode(&me)
	if err == nil {
		return &me
	} else {
		return nil
	}
}

func (me *ClusterInfo) SetAlive(alive bool) {
	if alive {
		atomic.StoreInt32(&me.Alive, 1)
	} else {
		atomic.StoreInt32(&me.Alive, 0)
	}
}

func (me *ClusterInfo) IsAlive() bool {
	return atomic.LoadInt32(&me.Alive) == 1
}

func (me *ClusterInfo) HaveEstablishedInitialContact() bool {
	me.Mutex.RLock()
	defer me.Mutex.RUnlock()
	if me.Id != "" {
		return true
	}

	return false
}

func (me *ClusterInfo) IdEqualTo(in string) bool {
	me.Mutex.RLock()
	defer me.Mutex.RUnlock()
	if me.Id == in {
		return true
	}

	return false
}

func ClusterInfosToJson(objmap []*ClusterInfo) string {
	if b, err := json.Marshal(objmap); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ClusterInfosFromJson(data io.Reader) []*ClusterInfo {
	decoder := json.NewDecoder(data)

	var objmap []*ClusterInfo
	if err := decoder.Decode(&objmap); err != nil {
		return make([]*ClusterInfo, 0)
	} else {
		return objmap
	}
}
