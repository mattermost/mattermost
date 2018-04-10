// Copyright 2018 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sysfs

import (
	"reflect"
	"testing"
)

func TestNewNetClass(t *testing.T) {
	fs, err := NewFS("fixtures")
	if err != nil {
		t.Fatal(err)
	}

	nc, err := fs.NewNetClass()
	if err != nil {
		t.Fatal(err)
	}

	netClass := NetClass{
		"eth0": {
			Address:          "01:01:01:01:01:01",
			AddrAssignType:   3,
			AddrLen:          6,
			Broadcast:        "ff:ff:ff:ff:ff:ff",
			Carrier:          1,
			CarrierChanges:   2,
			CarrierDownCount: 1,
			CarrierUpCount:   1,
			DevID:            32,
			Dormant:          1,
			Duplex:           "full",
			Flags:            4867,
			IfAlias:          "",
			IfIndex:          2,
			IfLink:           2,
			LinkMode:         1,
			MTU:              1500,
			Name:             "eth0",
			NameAssignType:   2,
			NetDevGroup:      0,
			OperState:        "up",
			PhysPortID:       "",
			PhysPortName:     "",
			PhysSwitchID:     "",
			Speed:            1000,
			TxQueueLen:       1000,
			Type:             1,
		},
	}

	if !reflect.DeepEqual(netClass, nc) {
		t.Errorf("Result not correct: want %v, have %v", netClass, nc)
	}
}
