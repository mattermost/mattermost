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

package nfs_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/prometheus/procfs/nfs"
)

func TestNewNFSdClientRPCStats(t *testing.T) {
	tests := []struct {
		name    string
		content string
		stats   *nfs.ClientRPCStats
		invalid bool
	}{
		{
			name:    "invalid file",
			content: "invalid",
			invalid: true,
		}, {
			name: "good file",
			content: `net 18628 0 18628 6
rpc 4329785 0 4338291
proc2 18 2 69 0 0 4410 0 0 0 0 0 0 0 0 0 0 0 99 2
proc3 22 1 4084749 29200 94754 32580 186 47747 7981 8639 0 6356 0 6962 0 7958 0 0 241 4 4 2 39
proc4 61 1 0 0 0 0 0 0 0 0 0 0 0 1 1 0 0 0 0 0 0 0 2 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
`,
			stats: &nfs.ClientRPCStats{
				Network: nfs.Network{
					NetCount:   18628,
					UDPCount:   0,
					TCPCount:   18628,
					TCPConnect: 6,
				},
				ClientRPC: nfs.ClientRPC{
					RPCCount:        4329785,
					Retransmissions: 0,
					AuthRefreshes:   4338291,
				},
				V2Stats: nfs.V2Stats{
					Null:     2,
					GetAttr:  69,
					SetAttr:  0,
					Root:     0,
					Lookup:   4410,
					ReadLink: 0,
					Read:     0,
					WrCache:  0,
					Write:    0,
					Create:   0,
					Remove:   0,
					Rename:   0,
					Link:     0,
					SymLink:  0,
					MkDir:    0,
					RmDir:    0,
					ReadDir:  99,
					FsStat:   2,
				},
				V3Stats: nfs.V3Stats{
					Null:        1,
					GetAttr:     4084749,
					SetAttr:     29200,
					Lookup:      94754,
					Access:      32580,
					ReadLink:    186,
					Read:        47747,
					Write:       7981,
					Create:      8639,
					MkDir:       0,
					SymLink:     6356,
					MkNod:       0,
					Remove:      6962,
					RmDir:       0,
					Rename:      7958,
					Link:        0,
					ReadDir:     0,
					ReadDirPlus: 241,
					FsStat:      4,
					FsInfo:      4,
					PathConf:    2,
					Commit:      39,
				},
				ClientV4Stats: nfs.ClientV4Stats{
					Null:               1,
					Read:               0,
					Write:              0,
					Commit:             0,
					Open:               0,
					OpenConfirm:        0,
					OpenNoattr:         0,
					OpenDowngrade:      0,
					Close:              0,
					Setattr:            0,
					FsInfo:             0,
					Renew:              0,
					SetClientId:        1,
					SetClientIdConfirm: 1,
					Lock:               0,
					Lockt:              0,
					Locku:              0,
					Access:             0,
					Getattr:            0,
					Lookup:             0,
					LookupRoot:         0,
					Remove:             2,
					Rename:             0,
					Link:               0,
					Symlink:            0,
					Create:             0,
					Pathconf:           0,
					StatFs:             0,
					ReadLink:           0,
					ReadDir:            0,
					ServerCaps:         0,
					DelegReturn:        0,
					GetAcl:             0,
					SetAcl:             0,
					FsLocations:        0,
					ReleaseLockowner:   0,
					Secinfo:            0,
					FsidPresent:        0,
					ExchangeId:         0,
					CreateSession:      0,
					DestroySession:     0,
					Sequence:           0,
					GetLeaseTime:       0,
					ReclaimComplete:    0,
					LayoutGet:          0,
					GetDeviceInfo:      0,
					LayoutCommit:       0,
					LayoutReturn:       0,
					SecinfoNoName:      0,
					TestStateId:        0,
					FreeStateId:        0,
					GetDeviceList:      0,
					BindConnToSession:  0,
					DestroyClientId:    0,
					Seek:               0,
					Allocate:           0,
					DeAllocate:         0,
					LayoutStats:        0,
					Clone:              0,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stats, err := nfs.ParseClientRPCStats(strings.NewReader(tt.content))

			if tt.invalid && err == nil {
				t.Fatal("expected an error, but none occurred")
			}
			if !tt.invalid && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if want, have := tt.stats, stats; !reflect.DeepEqual(want, have) {
				t.Fatalf("unexpected NFS stats:\nwant:\n%v\nhave:\n%v", want, have)
			}
		})
	}
}
