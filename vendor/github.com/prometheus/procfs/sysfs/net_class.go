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
	"fmt"
	"io/ioutil"
	"os"
	"reflect"
	"strconv"
	"strings"
	"syscall"
)

// NetClassIface contains info from files in /sys/class/net/<iface>
// for single interface (iface).
type NetClassIface struct {
	Name             string // Interface name
	AddrAssignType   int64  `fileName:"addr_assign_type"`   // /sys/class/net/<iface>/addr_assign_type
	AddrLen          int64  `fileName:"addr_len"`           // /sys/class/net/<iface>/addr_len
	Address          string `fileName:"address"`            // /sys/class/net/<iface>/address
	Broadcast        string `fileName:"broadcast"`          // /sys/class/net/<iface>/broadcast
	Carrier          int64  `fileName:"carrier"`            // /sys/class/net/<iface>/carrier
	CarrierChanges   int64  `fileName:"carrier_changes"`    // /sys/class/net/<iface>/carrier_changes
	CarrierUpCount   int64  `fileName:"carrier_up_count"`   // /sys/class/net/<iface>/carrier_up_count
	CarrierDownCount int64  `fileName:"carrier_down_count"` // /sys/class/net/<iface>/carrier_down_count
	DevID            int64  `fileName:"dev_id"`             // /sys/class/net/<iface>/dev_id
	Dormant          int64  `fileName:"dormant"`            // /sys/class/net/<iface>/dormant
	Duplex           string `fileName:"duplex"`             // /sys/class/net/<iface>/duplex
	Flags            int64  `fileName:"flags"`              // /sys/class/net/<iface>/flags
	IfAlias          string `fileName:"ifalias"`            // /sys/class/net/<iface>/ifalias
	IfIndex          int64  `fileName:"ifindex"`            // /sys/class/net/<iface>/ifindex
	IfLink           int64  `fileName:"iflink"`             // /sys/class/net/<iface>/iflink
	LinkMode         int64  `fileName:"link_mode"`          // /sys/class/net/<iface>/link_mode
	MTU              int64  `fileName:"mtu"`                // /sys/class/net/<iface>/mtu
	NameAssignType   int64  `fileName:"name_assign_type"`   // /sys/class/net/<iface>/name_assign_type
	NetDevGroup      int64  `fileName:"netdev_group"`       // /sys/class/net/<iface>/netdev_group
	OperState        string `fileName:"operstate"`          // /sys/class/net/<iface>/operstate
	PhysPortID       string `fileName:"phys_port_id"`       // /sys/class/net/<iface>/phys_port_id
	PhysPortName     string `fileName:"phys_port_name"`     // /sys/class/net/<iface>/phys_port_name
	PhysSwitchID     string `fileName:"phys_switch_id"`     // /sys/class/net/<iface>/phys_switch_id
	Speed            int64  `fileName:"speed"`              // /sys/class/net/<iface>/speed
	TxQueueLen       int64  `fileName:"tx_queue_len"`       // /sys/class/net/<iface>/tx_queue_len
	Type             int64  `fileName:"type"`               // /sys/class/net/<iface>/type
}

// NetClass is collection of info for every interface (iface) in /sys/class/net. The map keys
// are interface (iface) names.
type NetClass map[string]NetClassIface

// NewNetClass returns info for all net interfaces (iface) read from /sys/class/net/<iface>.
func NewNetClass() (NetClass, error) {
	fs, err := NewFS(DefaultMountPoint)
	if err != nil {
		return nil, err
	}

	return fs.NewNetClass()
}

// NewNetClass returns info for all net interfaces (iface) read from /sys/class/net/<iface>.
func (fs FS) NewNetClass() (NetClass, error) {
	path := fs.Path("class/net")

	devices, err := ioutil.ReadDir(path)
	if err != nil {
		return NetClass{}, fmt.Errorf("cannot access %s dir %s", path, err)
	}

	netClass := NetClass{}
	for _, deviceDir := range devices {
		interfaceClass, err := netClass.parseNetClassIface(path + "/" + deviceDir.Name())
		if err != nil {
			return nil, err
		}
		interfaceClass.Name = deviceDir.Name()
		netClass[deviceDir.Name()] = *interfaceClass
	}
	return netClass, nil
}

// parseNetClassIface scans predefined files in /sys/class/net/<iface>
// directory and gets their contents.
func (nc NetClass) parseNetClassIface(devicePath string) (*NetClassIface, error) {
	interfaceClass := NetClassIface{}
	interfaceElem := reflect.ValueOf(&interfaceClass).Elem()
	interfaceType := reflect.TypeOf(interfaceClass)

	//start from 1 - skip the Name field
	for i := 1; i < interfaceElem.NumField(); i++ {
		fieldType := interfaceType.Field(i)
		fieldValue := interfaceElem.Field(i)

		if fieldType.Tag.Get("fileName") == "" {
			panic(fmt.Errorf("field %s does not have a filename tag", fieldType.Name))
		}

		fileContents, err := sysReadFile(devicePath + "/" + fieldType.Tag.Get("fileName"))

		if err != nil {
			if os.IsNotExist(err) || err.Error() == "operation not supported" || err.Error() == "invalid argument" {
				continue
			}
			return nil, fmt.Errorf("could not access file %s: %s", fieldType.Tag.Get("fileName"), err)
		}
		value := strings.TrimSpace(string(fileContents))

		switch fieldValue.Kind() {
		case reflect.Int64:
			if strings.HasPrefix(value, "0x") {
				intValue, err := strconv.ParseInt(value[2:], 16, 64)
				if err != nil {
					return nil, fmt.Errorf("expected hex value for %s, got: %s", fieldType.Name, value)
				}
				fieldValue.SetInt(intValue)
			} else {
				intValue, err := strconv.ParseInt(value, 10, 64)
				if err != nil {
					return nil, fmt.Errorf("expected Uint64 value for %s, got: %s", fieldType.Name, value)
				}
				fieldValue.SetInt(intValue)
			}
		case reflect.String:
			fieldValue.SetString(value)
		default:
			return nil, fmt.Errorf("unhandled type %q", fieldValue.Kind())
		}
	}

	return &interfaceClass, nil
}

// sysReadFile is a simplified ioutil.ReadFile that invokes syscall.Read directly.
// https://github.com/prometheus/node_exporter/pull/728/files
func sysReadFile(file string) ([]byte, error) {
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// On some machines, hwmon drivers are broken and return EAGAIN.  This causes
	// Go's ioutil.ReadFile implementation to poll forever.
	//
	// Since we either want to read data or bail immediately, do the simplest
	// possible read using syscall directly.
	b := make([]byte, 128)
	n, err := syscall.Read(int(f.Fd()), b)
	if err != nil {
		return nil, err
	}

	return b[:n], nil
}
