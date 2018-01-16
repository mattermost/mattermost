// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sandbox

import (
	"syscall"
	"unsafe"

	"github.com/pkg/errors"
	"golang.org/x/net/bpf"
	"golang.org/x/sys/unix"
)

const (
	SECCOMP_RET_ALLOW = 0x7fff0000
	SECCOMP_RET_ERRNO = 0x00050000
)

const (
	EM_X86_64 = 62

	__AUDIT_ARCH_64BIT = 0x80000000
	__AUDIT_ARCH_LE    = 0x40000000

	AUDIT_ARCH_X86_64 = EM_X86_64 | __AUDIT_ARCH_64BIT | __AUDIT_ARCH_LE

	nrSize     = 4
	archOffset = nrSize
	ipOffset   = archOffset + 4
	argsOffset = ipOffset + 8
)

type SeccompCondition interface {
	Filter(littleEndian bool, skipFalseSentinel uint8) []bpf.Instruction
}

func seccompArgLowWord(arg int, littleEndian bool) uint32 {
	offset := uint32(argsOffset + arg*8)
	if !littleEndian {
		offset += 4
	}
	return offset
}

func seccompArgHighWord(arg int, littleEndian bool) uint32 {
	offset := uint32(argsOffset + arg*8)
	if littleEndian {
		offset += 4
	}
	return offset
}

type SeccompArgHasNoBits struct {
	Arg  int
	Mask uint64
}

func (c SeccompArgHasNoBits) Filter(littleEndian bool, skipFalseSentinel uint8) []bpf.Instruction {
	return []bpf.Instruction{
		bpf.LoadAbsolute{Off: seccompArgHighWord(c.Arg, littleEndian), Size: 4},
		bpf.JumpIf{Cond: bpf.JumpBitsSet, Val: uint32(c.Mask >> 32), SkipTrue: skipFalseSentinel},
		bpf.LoadAbsolute{Off: seccompArgLowWord(c.Arg, littleEndian), Size: 4},
		bpf.JumpIf{Cond: bpf.JumpBitsSet, Val: uint32(c.Mask), SkipTrue: skipFalseSentinel},
	}
}

type SeccompArgHasAnyBit struct {
	Arg  int
	Mask uint64
}

func (c SeccompArgHasAnyBit) Filter(littleEndian bool, skipFalseSentinel uint8) []bpf.Instruction {
	return []bpf.Instruction{
		bpf.LoadAbsolute{Off: seccompArgHighWord(c.Arg, littleEndian), Size: 4},
		bpf.JumpIf{Cond: bpf.JumpBitsSet, Val: uint32(c.Mask >> 32), SkipTrue: 2},
		bpf.LoadAbsolute{Off: seccompArgLowWord(c.Arg, littleEndian), Size: 4},
		bpf.JumpIf{Cond: bpf.JumpBitsSet, Val: uint32(c.Mask), SkipFalse: skipFalseSentinel},
	}
}

type SeccompArgEquals struct {
	Arg   int
	Value uint64
}

func (c SeccompArgEquals) Filter(littleEndian bool, skipFalseSentinel uint8) []bpf.Instruction {
	return []bpf.Instruction{
		bpf.LoadAbsolute{Off: seccompArgHighWord(c.Arg, littleEndian), Size: 4},
		bpf.JumpIf{Cond: bpf.JumpEqual, Val: uint32(c.Value >> 32), SkipFalse: skipFalseSentinel},
		bpf.LoadAbsolute{Off: seccompArgLowWord(c.Arg, littleEndian), Size: 4},
		bpf.JumpIf{Cond: bpf.JumpEqual, Val: uint32(c.Value), SkipFalse: skipFalseSentinel},
	}
}

type SeccompConditions struct {
	All []SeccompCondition
}

type SeccompSyscall struct {
	Syscall uint32
	Any     []SeccompConditions
}

func SeccompFilter(arch uint32, allowedSyscalls []SeccompSyscall) (filter []bpf.Instruction) {
	filter = append(filter,
		bpf.LoadAbsolute{Off: archOffset, Size: 4},
		bpf.JumpIf{Cond: bpf.JumpEqual, Val: arch, SkipTrue: 1},
		bpf.RetConstant{Val: uint32(SECCOMP_RET_ERRNO | unix.EPERM)},
	)

	filter = append(filter, bpf.LoadAbsolute{Off: 0, Size: nrSize})
	for _, s := range allowedSyscalls {
		if s.Any != nil {
			syscallStart := len(filter)
			filter = append(filter, bpf.Instruction(nil))
			for _, cs := range s.Any {
				anyStart := len(filter)
				for _, c := range cs.All {
					filter = append(filter, c.Filter((arch&__AUDIT_ARCH_LE) != 0, 255)...)
				}
				filter = append(filter, bpf.RetConstant{Val: SECCOMP_RET_ALLOW})
				for i := anyStart; i < len(filter); i++ {
					if jump, ok := filter[i].(bpf.JumpIf); ok {
						if len(filter)-i-1 > 255 {
							panic("condition too long")
						}
						if jump.SkipFalse == 255 {
							jump.SkipFalse = uint8(len(filter) - i - 1)
						}
						if jump.SkipTrue == 255 {
							jump.SkipTrue = uint8(len(filter) - i - 1)
						}
						filter[i] = jump
					}
				}
			}
			filter = append(filter, bpf.RetConstant{Val: uint32(SECCOMP_RET_ERRNO | unix.EPERM)})
			if len(filter)-syscallStart-1 > 255 {
				panic("conditions too long")
			}
			filter[syscallStart] = bpf.JumpIf{Cond: bpf.JumpEqual, Val: uint32(s.Syscall), SkipFalse: uint8(len(filter) - syscallStart - 1)}
		} else {
			filter = append(filter,
				bpf.JumpIf{Cond: bpf.JumpEqual, Val: uint32(s.Syscall), SkipFalse: 1},
				bpf.RetConstant{Val: SECCOMP_RET_ALLOW},
			)
		}
	}

	return append(filter, bpf.RetConstant{Val: uint32(SECCOMP_RET_ERRNO | unix.EPERM)})
}

func EnableSeccompFilter(filter []bpf.Instruction) error {
	assembled, err := bpf.Assemble(filter)
	if err != nil {
		return errors.Wrapf(err, "unable to assemble filter")
	}

	sockFilter := make([]unix.SockFilter, len(filter))
	for i, instruction := range assembled {
		sockFilter[i].Code = instruction.Op
		sockFilter[i].Jt = instruction.Jt
		sockFilter[i].Jf = instruction.Jf
		sockFilter[i].K = instruction.K
	}

	prog := unix.SockFprog{
		Len:    uint16(len(sockFilter)),
		Filter: &sockFilter[0],
	}

	if _, _, errno := syscall.Syscall(syscall.SYS_PRCTL, unix.PR_SET_SECCOMP, unix.SECCOMP_MODE_FILTER, uintptr(unsafe.Pointer(&prog))); errno != 0 {
		return errors.Wrapf(syscall.Errno(errno), "syscall error")
	}

	return nil
}
