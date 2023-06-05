// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package printer

// These are the key that aliases
const (
	ArrowLeft  = rune(KeyCtrlB)
	ArrowRight = rune(KeyCtrlF)
	ArrowUp    = rune(KeyCtrlP)
	ArrowDown  = rune(KeyCtrlN)
	Space      = ' '
	Enter      = '\r'
	NewLine    = '\n'
	Backspace  = rune(KeyCtrlH)
	Backspace2 = rune(KeyDEL)
)

// Key is the ascii codes of a keys
type Key int16

// These are the control keys.  Note that they overlap with other keys.
const (
	KeyCtrlSpace      Key = iota
	KeyCtrlA              // KeySOH
	KeyCtrlB              // KeySTX
	KeyCtrlC              // KeyETX
	KeyCtrlD              // KeyEOT
	KeyCtrlE              // KeyENQ
	KeyCtrlF              // KeyACK
	KeyCtrlG              // KeyBEL
	KeyCtrlH              // KeyBS
	KeyCtrlI              // KeyTAB
	KeyCtrlJ              // KeyLF
	KeyCtrlK              // KeyVT
	KeyCtrlL              // KeyFF
	KeyCtrlM              // KeyCR
	KeyCtrlN              // KeySO
	KeyCtrlO              // KeySI
	KeyCtrlP              // KeyDLE
	KeyCtrlQ              // KeyDC1
	KeyCtrlR              // KeyDC2
	KeyCtrlS              // KeyDC3
	KeyCtrlT              // KeyDC4
	KeyCtrlU              // KeyNAK
	KeyCtrlV              // KeySYN
	KeyCtrlW              // KeyETB
	KeyCtrlX              // KeyCAN
	KeyCtrlY              // KeyEM
	KeyCtrlZ              // KeySUB
	KeyESC                // KeyESC
	KeyCtrlBackslash      // KeyFS
	KeyCtrlRightSq        // KeyGS
	KeyCtrlCarat          // KeyRS
	KeyCtrlUnderscore     // KeyUS
	KeyDEL            = 0x7F
)
