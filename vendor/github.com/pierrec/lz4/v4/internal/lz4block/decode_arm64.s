// +build gc
// +build !noasm

// This implementation assumes that strict alignment checking is turned off.
// The Go compiler makes the same assumption.

#include "go_asm.h"
#include "textflag.h"

// Register allocation.
#define dst	R0
#define dstorig	R1
#define src	R2
#define dstend	R3
#define srcend	R4
#define match	R5	// Match address.
#define dict	R6
#define dictlen	R7
#define dictend	R8
#define token	R9
#define len	R10	// Literal and match lengths.
#define lenRem	R11
#define offset	R12	// Match offset.
#define tmp1	R13
#define tmp2	R14
#define tmp3	R15
#define tmp4	R16

// func decodeBlock(dst, src, dict []byte) int
TEXT ·decodeBlock(SB), NOFRAME+NOSPLIT, $0-80
	LDP  dst_base+0(FP), (dst, dstend)
	ADD  dst, dstend
	MOVD dst, dstorig

	LDP src_base+24(FP), (src, srcend)
	CBZ srcend, shortSrc
	ADD src, srcend

	LDP dict_base+48(FP), (dict, dictlen)
	ADD dict, dictlen, dictend

loop:
	// Read token. Extract literal length.
	MOVBU.P 1(src), token
	LSR     $4, token, len
	CMP     $15, len
	BNE     readLitlenDone

readLitlenLoop:
	CMP     src, srcend
	BEQ     shortSrc
	MOVBU.P 1(src), tmp1
	ADDS    tmp1, len
	BVS     shortDst
	CMP     $255, tmp1
	BEQ     readLitlenLoop

readLitlenDone:
	CBZ len, copyLiteralDone

	// Bounds check dst+len and src+len.
	ADDS dst, len, tmp1
	BCS  shortSrc
	ADDS src, len, tmp2
	BCS  shortSrc
	CMP  dstend, tmp1
	BHI  shortDst
	CMP  srcend, tmp2
	BHI  shortSrc

	// Copy literal.
	SUBS $16, len
	BLO  copyLiteralShort
	AND  $15, len, lenRem

copyLiteralLoop:
	SUBS  $16, len
	LDP.P 16(src), (tmp1, tmp2)
	STP.P (tmp1, tmp2), 16(dst)
	BPL   copyLiteralLoop

	// lenRem = len%16 is the remaining number of bytes we need to copy.
	// Since len was >= 16, we can do this in one load and one store,
	// overlapping with the last load and store, without worrying about
	// writing out of bounds.
	ADD lenRem, src
	ADD lenRem, dst
	LDP -16(src), (tmp1, tmp2)
	STP (tmp1, tmp2), -16(dst)

	B copyLiteralDone

	// Copy literal of length 0-15.
copyLiteralShort:
	TBZ     $3, len, 3(PC)
	MOVD.P  8(src), tmp1
	MOVD.P  tmp1, 8(dst)
	TBZ     $2, len, 3(PC)
	MOVW.P  4(src), tmp2
	MOVW.P  tmp2, 4(dst)
	TBZ     $1, len, 3(PC)
	MOVH.P  2(src), tmp3
	MOVH.P  tmp3, 2(dst)
	TBZ     $0, len, 3(PC)
	MOVBU.P 1(src), tmp4
	MOVB.P  tmp4, 1(dst)

copyLiteralDone:
	CMP src, srcend
	BEQ end

	// Read offset.
	ADDS  $2, src
	BCS   shortSrc
	CMP   srcend, src
	BHI   shortSrc
	MOVHU -2(src), offset
	CBZ   offset, corrupt

	// Read match length.
	AND $15, token, len
	CMP $15, len
	BNE readMatchlenDone

readMatchlenLoop:
	CMP     src, srcend
	BEQ     shortSrc
	MOVBU.P 1(src), tmp1
	ADDS    tmp1, len
	BVS     shortDst
	CMP     $255, tmp1
	BEQ     readMatchlenLoop

readMatchlenDone:
	ADD $const_minMatch, len

	// Bounds check dst+len.
	ADDS dst, len, tmp2
	BCS  shortDst
	CMP  dstend, tmp2
	BHI  shortDst

	SUB offset, dst, match
	CMP dstorig, match
	BHS copyMatchTry8

	// match < dstorig means the match starts in the dictionary,
	// at len(dict) - offset + (dst - dstorig).
	SUB  dstorig, dst, tmp1
	SUB  offset, dictlen, tmp2
	ADDS tmp2, tmp1
	BMI  shortDict
	ADD  dict, tmp1, match

copyDict:
	MOVBU.P 1(match), tmp3
	MOVB.P  tmp3, 1(dst)
	SUBS    $1, len
	CCMP    NE, dictend, match, $0b0100 // 0100 sets the Z (EQ) flag.
	BNE     copyDict

	CBZ  len, copyMatchDone

	// If the match extends beyond the dictionary, the rest is at dstorig.
	MOVD dstorig, match

	// The code up to copyMatchLoop1 assumes len >= minMatch.
	CMP $const_minMatch, len
	BLO copyMatchLoop1

copyMatchTry8:
	// Copy doublewords if both len and offset are at least eight.
	// A 16-at-a-time loop doesn't provide a further speedup.
	CMP  $8, len
	CCMP HS, offset, $8, $0
	BLO  copyMatchLoop1

	AND    $7, len, lenRem
	SUB    $8, len
copyMatchLoop8:
	SUBS   $8, len
	MOVD.P 8(match), tmp1
	MOVD.P tmp1, 8(dst)
	BPL    copyMatchLoop8

	ADD  lenRem, match
	ADD  lenRem, dst
	MOVD -8(match), tmp2
	MOVD tmp2, -8(dst)
	B    copyMatchDone

	// 4× unrolled byte copy loop for the overlapping case.
copyMatchLoop4:
	SUB     $4, len
	MOVBU.P 4(match), tmp1
	MOVB.P  tmp1, 4(dst)
	MOVBU   -3(match), tmp2
	MOVB    tmp2, -3(dst)
	MOVBU   -2(match), tmp3
	MOVB    tmp3, -2(dst)
	MOVBU   -1(match), tmp4
	MOVB    tmp4, -1(dst)
	CBNZ   len, copyMatchLoop4

copyMatchLoop1:
	// Finish with a byte-at-a-time copy.
	SUB     $1, len
	MOVBU.P 1(match), tmp2
	MOVB.P  tmp2, 1(dst)
	CBNZ    len, copyMatchLoop1

copyMatchDone:
	CMP src, srcend
	BNE loop

end:
	SUB  dstorig, dst, tmp1
	MOVD tmp1, ret+72(FP)
	RET

	// The error cases have distinct labels so we can put different
	// return codes here when debugging, or if the error returns need to
	// be changed.
shortDict:
shortDst:
shortSrc:
corrupt:
	MOVD $-1, tmp1
	MOVD tmp1, ret+72(FP)
	RET
