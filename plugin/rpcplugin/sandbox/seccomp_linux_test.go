// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sandbox

import (
	"encoding/binary"
	"syscall"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/bpf"
)

func seccompData(nr int32, arch uint32, ip uint64, args ...uint64) []byte {
	var buf [64]byte
	binary.BigEndian.PutUint32(buf[0:], uint32(nr))
	binary.BigEndian.PutUint32(buf[4:], arch)
	binary.BigEndian.PutUint64(buf[8:], ip)
	for i := 0; i < 6 && i < len(args); i++ {
		binary.BigEndian.PutUint64(buf[16+i*8:], args[i])
	}
	return buf[:]
}

func TestSeccompFilter(t *testing.T) {
	for name, tc := range map[string]struct {
		Filter   []bpf.Instruction
		Data     []byte
		Expected bool
	}{
		"Allowed": {
			Filter: SeccompFilter(0xf00, []SeccompSyscall{
				{Syscall: syscall.SYS_READ},
				{Syscall: syscall.SYS_WRITE},
			}),
			Data:     seccompData(syscall.SYS_READ, 0xf00, 0),
			Expected: true,
		},
		"AllFail": {
			Filter: SeccompFilter(0xf00, []SeccompSyscall{
				{
					Syscall: syscall.SYS_READ,
					Any: []SeccompConditions{
						{All: []SeccompCondition{
							&SeccompArgHasAnyBit{Arg: 0, Mask: 2},
							&SeccompArgHasAnyBit{Arg: 1, Mask: 2},
							&SeccompArgHasAnyBit{Arg: 2, Mask: 2},
							&SeccompArgHasAnyBit{Arg: 3, Mask: 2},
						}},
					},
				},
				{Syscall: syscall.SYS_WRITE},
			}),
			Data:     seccompData(syscall.SYS_READ, 0xf00, 0, 1, 2, 3, 4),
			Expected: false,
		},
		"AllPass": {
			Filter: SeccompFilter(0xf00, []SeccompSyscall{
				{
					Syscall: syscall.SYS_READ,
					Any: []SeccompConditions{
						{All: []SeccompCondition{
							&SeccompArgHasAnyBit{Arg: 0, Mask: 7},
							&SeccompArgHasAnyBit{Arg: 1, Mask: 7},
							&SeccompArgHasAnyBit{Arg: 2, Mask: 7},
							&SeccompArgHasAnyBit{Arg: 3, Mask: 7},
						}},
					},
				},
				{Syscall: syscall.SYS_WRITE},
			}),
			Data:     seccompData(syscall.SYS_READ, 0xf00, 0, 1, 2, 3, 4),
			Expected: true,
		},
		"AnyFail": {
			Filter: SeccompFilter(0xf00, []SeccompSyscall{
				{
					Syscall: syscall.SYS_READ,
					Any: []SeccompConditions{
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 0, Mask: 8}}},
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 1, Mask: 8}}},
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 2, Mask: 8}}},
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 3, Mask: 8}}},
					},
				},
				{Syscall: syscall.SYS_WRITE},
			}),
			Data:     seccompData(syscall.SYS_READ, 0xf00, 0, 1, 2, 3, 4),
			Expected: false,
		},
		"AnyPass": {
			Filter: SeccompFilter(0xf00, []SeccompSyscall{
				{
					Syscall: syscall.SYS_READ,
					Any: []SeccompConditions{
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 0, Mask: 2}}},
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 1, Mask: 2}}},
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 2, Mask: 2}}},
						{All: []SeccompCondition{&SeccompArgHasAnyBit{Arg: 3, Mask: 2}}},
					},
				},
				{Syscall: syscall.SYS_WRITE},
			}),
			Data:     seccompData(syscall.SYS_READ, 0xf00, 0, 1, 2, 3, 4),
			Expected: true,
		},
		"BadArch": {
			Filter: SeccompFilter(0xf00, []SeccompSyscall{
				{Syscall: syscall.SYS_READ},
				{Syscall: syscall.SYS_WRITE},
			}),
			Data:     seccompData(syscall.SYS_MOUNT, 0xf01, 0),
			Expected: false,
		},
		"BadSyscall": {
			Filter: SeccompFilter(0xf00, []SeccompSyscall{
				{Syscall: syscall.SYS_READ},
				{Syscall: syscall.SYS_WRITE},
			}),
			Data:     seccompData(syscall.SYS_MOUNT, 0xf00, 0),
			Expected: false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			vm, err := bpf.NewVM(tc.Filter)
			require.NoError(t, err)
			result, err := vm.Run(tc.Data)
			require.NoError(t, err)
			if tc.Expected {
				assert.Equal(t, SECCOMP_RET_ALLOW, result)
			} else {
				assert.Equal(t, int(SECCOMP_RET_ERRNO|syscall.EPERM), result)
			}
		})
	}
}

func TestSeccompFilter_Conditions(t *testing.T) {
	for name, tc := range map[string]struct {
		Condition SeccompCondition
		Args      []uint64
		Expected  bool
	}{
		"ArgHasAnyBitFail": {
			Condition: SeccompArgHasAnyBit{Arg: 0, Mask: 0x0004},
			Args:      []uint64{0x0400008000},
			Expected:  false,
		},
		"ArgHasAnyBitPass1": {
			Condition: SeccompArgHasAnyBit{Arg: 0, Mask: 0x400000004},
			Args:      []uint64{0x8000008004},
			Expected:  true,
		},
		"ArgHasAnyBitPass2": {
			Condition: SeccompArgHasAnyBit{Arg: 0, Mask: 0x400000004},
			Args:      []uint64{0x8400008000},
			Expected:  true,
		},
		"ArgHasNoBitsFail1": {
			Condition: SeccompArgHasNoBits{Arg: 0, Mask: 0x1100000011},
			Args:      []uint64{0x0000008007},
			Expected:  false,
		},
		"ArgHasNoBitsFail2": {
			Condition: SeccompArgHasNoBits{Arg: 0, Mask: 0x1100000011},
			Args:      []uint64{0x0700008000},
			Expected:  false,
		},
		"ArgHasNoBitsPass": {
			Condition: SeccompArgHasNoBits{Arg: 0, Mask: 0x400000004},
			Args:      []uint64{0x8000008000},
			Expected:  true,
		},
		"ArgEqualsPass": {
			Condition: SeccompArgEquals{Arg: 0, Value: 0x123456789ABCDEF},
			Args:      []uint64{0x123456789ABCDEF},
			Expected:  true,
		},
		"ArgEqualsFail1": {
			Condition: SeccompArgEquals{Arg: 0, Value: 0x123456789ABCDEF},
			Args:      []uint64{0x023456789ABCDEF},
			Expected:  false,
		},
		"ArgEqualsFail2": {
			Condition: SeccompArgEquals{Arg: 0, Value: 0x123456789ABCDEF},
			Args:      []uint64{0x123456789ABCDE0},
			Expected:  false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			filter := SeccompFilter(0xf00, []SeccompSyscall{
				{
					Syscall: 1,
					Any:     []SeccompConditions{{All: []SeccompCondition{tc.Condition}}},
				},
			})
			vm, err := bpf.NewVM(filter)
			require.NoError(t, err)
			result, err := vm.Run(seccompData(1, 0xf00, 0, tc.Args...))
			require.NoError(t, err)
			if tc.Expected {
				assert.Equal(t, SECCOMP_RET_ALLOW, result)
			} else {
				assert.Equal(t, int(SECCOMP_RET_ERRNO|syscall.EPERM), result)
			}
		})
	}
}
