// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.7,amd64,!gccgo,!appengine

#include "textflag.h"

DATA ·AVX_iv0<>+0x00(SB)/8, $0x6a09e667f3bcc908
DATA ·AVX_iv0<>+0x08(SB)/8, $0xbb67ae8584caa73b
DATA ·AVX_iv0<>+0x10(SB)/8, $0x3c6ef372fe94f82b
DATA ·AVX_iv0<>+0x18(SB)/8, $0xa54ff53a5f1d36f1
GLOBL ·AVX_iv0<>(SB), (NOPTR+RODATA), $32

DATA ·AVX_iv1<>+0x00(SB)/8, $0x510e527fade682d1
DATA ·AVX_iv1<>+0x08(SB)/8, $0x9b05688c2b3e6c1f
DATA ·AVX_iv1<>+0x10(SB)/8, $0x1f83d9abfb41bd6b
DATA ·AVX_iv1<>+0x18(SB)/8, $0x5be0cd19137e2179
GLOBL ·AVX_iv1<>(SB), (NOPTR+RODATA), $32

DATA ·AVX_c40<>+0x00(SB)/8, $0x0201000706050403
DATA ·AVX_c40<>+0x08(SB)/8, $0x0a09080f0e0d0c0b
DATA ·AVX_c40<>+0x10(SB)/8, $0x0201000706050403
DATA ·AVX_c40<>+0x18(SB)/8, $0x0a09080f0e0d0c0b
GLOBL ·AVX_c40<>(SB), (NOPTR+RODATA), $32

DATA ·AVX_c48<>+0x00(SB)/8, $0x0100070605040302
DATA ·AVX_c48<>+0x08(SB)/8, $0x09080f0e0d0c0b0a
DATA ·AVX_c48<>+0x10(SB)/8, $0x0100070605040302
DATA ·AVX_c48<>+0x18(SB)/8, $0x09080f0e0d0c0b0a
GLOBL ·AVX_c48<>(SB), (NOPTR+RODATA), $32

// unfortunately the BYTE representation of VPERMQ must be used
#define ROUND(m0, m1, m2, m3, t, c40, c48) \
	VPADDQ  m0, Y0, Y0;                                                       \
	VPADDQ  Y1, Y0, Y0;                                                       \
	VPXOR   Y0, Y3, Y3;                                                       \
	VPSHUFD $-79, Y3, Y3;                                                     \
	VPADDQ  Y3, Y2, Y2;                                                       \
	VPXOR   Y2, Y1, Y1;                                                       \
	VPSHUFB c40, Y1, Y1;                                                      \
	VPADDQ  m1, Y0, Y0;                                                       \
	VPADDQ  Y1, Y0, Y0;                                                       \
	VPXOR   Y0, Y3, Y3;                                                       \
	VPSHUFB c48, Y3, Y3;                                                      \
	VPADDQ  Y3, Y2, Y2;                                                       \
	VPXOR   Y2, Y1, Y1;                                                       \
	VPADDQ  Y1, Y1, t;                                                        \
	VPSRLQ  $63, Y1, Y1;                                                      \
	VPXOR   t, Y1, Y1;                                                        \
	BYTE    $0xc4; BYTE $0xe3; BYTE $0xfd; BYTE $0x00; BYTE $0xc9; BYTE $0x39 \ // VPERMQ 0x39, Y1, Y1
	BYTE    $0xc4; BYTE $0xe3; BYTE $0xfd; BYTE $0x00; BYTE $0xd2; BYTE $0x4e \ // VPERMQ 0x4e, Y2, Y2
	BYTE    $0xc4; BYTE $0xe3; BYTE $0xfd; BYTE $0x00; BYTE $0xdb; BYTE $0x93 \ // VPERMQ 0x93, Y3, Y3
	VPADDQ  m2, Y0, Y0;                                                       \
	VPADDQ  Y1, Y0, Y0;                                                       \
	VPXOR   Y0, Y3, Y3;                                                       \
	VPSHUFD $-79, Y3, Y3;                                                     \
	VPADDQ  Y3, Y2, Y2;                                                       \
	VPXOR   Y2, Y1, Y1;                                                       \
	VPSHUFB c40, Y1, Y1;                                                      \
	VPADDQ  m3, Y0, Y0;                                                       \
	VPADDQ  Y1, Y0, Y0;                                                       \
	VPXOR   Y0, Y3, Y3;                                                       \
	VPSHUFB c48, Y3, Y3;                                                      \
	VPADDQ  Y3, Y2, Y2;                                                       \
	VPXOR   Y2, Y1, Y1;                                                       \
	VPADDQ  Y1, Y1, t;                                                        \
	VPSRLQ  $63, Y1, Y1;                                                      \
	VPXOR   t, Y1, Y1;                                                        \
	BYTE    $0xc4; BYTE $0xe3; BYTE $0xfd; BYTE $0x00; BYTE $0xdb; BYTE $0x39 \ // VPERMQ 0x39, Y3, Y3
	BYTE    $0xc4; BYTE $0xe3; BYTE $0xfd; BYTE $0x00; BYTE $0xd2; BYTE $0x4e \ // VPERMQ 0x4e, Y2, Y2
	BYTE    $0xc4; BYTE $0xe3; BYTE $0xfd; BYTE $0x00; BYTE $0xc9; BYTE $0x93 \ // VPERMQ 0x93, Y1, Y1

// load msg into Y12, Y13, Y14, Y15
#define LOAD_MSG(src, i0, i1, i2, i3, i4, i5, i6, i7, i8, i9, i10, i11, i12, i13, i14, i15) \
	MOVQ        i0*8(src), X12;      \
	PINSRQ      $1, i1*8(src), X12;  \
	MOVQ        i2*8(src), X11;      \
	PINSRQ      $1, i3*8(src), X11;  \
	VINSERTI128 $1, X11, Y12, Y12;   \
	MOVQ        i4*8(src), X13;      \
	PINSRQ      $1, i5*8(src), X13;  \
	MOVQ        i6*8(src), X11;      \
	PINSRQ      $1, i7*8(src), X11;  \
	VINSERTI128 $1, X11, Y13, Y13;   \
	MOVQ        i8*8(src), X14;      \
	PINSRQ      $1, i9*8(src), X14;  \
	MOVQ        i10*8(src), X11;     \
	PINSRQ      $1, i11*8(src), X11; \
	VINSERTI128 $1, X11, Y14, Y14;   \
	MOVQ        i12*8(src), X15;     \
	PINSRQ      $1, i13*8(src), X15; \
	MOVQ        i14*8(src), X11;     \
	PINSRQ      $1, i15*8(src), X11; \
	VINSERTI128 $1, X11, Y15, Y15

// func hashBlocksAVX2(h *[8]uint64, c *[2]uint64, flag uint64, blocks []byte)
TEXT ·hashBlocksAVX2(SB), 4, $320-48 // frame size = 288 + 32 byte alignment
	MOVQ h+0(FP), AX
	MOVQ c+8(FP), BX
	MOVQ flag+16(FP), CX
	MOVQ blocks_base+24(FP), SI
	MOVQ blocks_len+32(FP), DI

	MOVQ SP, DX
	MOVQ SP, R9
	ADDQ $31, R9
	ANDQ $~31, R9
	MOVQ R9, SP

	MOVQ CX, 16(SP)
	XORQ CX, CX
	MOVQ CX, 24(SP)

	VMOVDQU ·AVX_c40<>(SB), Y4
	VMOVDQU ·AVX_c48<>(SB), Y5

	VMOVDQU 0(AX), Y8
	VMOVDQU 32(AX), Y9
	VMOVDQU ·AVX_iv0<>(SB), Y6
	VMOVDQU ·AVX_iv1<>(SB), Y7

	MOVQ 0(BX), R8
	MOVQ 8(BX), R9
	MOVQ R9, 8(SP)

loop:
	ADDQ $128, R8
	MOVQ R8, 0(SP)
	CMPQ R8, $128
	JGE  noinc
	INCQ R9
	MOVQ R9, 8(SP)

noinc:
	VMOVDQA Y8, Y0
	VMOVDQA Y9, Y1
	VMOVDQU Y6, Y2
	VPXOR   0(SP), Y7, Y3

	LOAD_MSG(SI, 0, 2, 4, 6, 1, 3, 5, 7, 8, 10, 12, 14, 9, 11, 13, 15)
	VMOVDQA Y12, 32(SP)
	VMOVDQA Y13, 64(SP)
	VMOVDQA Y14, 96(SP)
	VMOVDQA Y15, 128(SP)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 14, 4, 9, 13, 10, 8, 15, 6, 1, 0, 11, 5, 12, 2, 7, 3)
	VMOVDQA Y12, 160(SP)
	VMOVDQA Y13, 192(SP)
	VMOVDQA Y14, 224(SP)
	VMOVDQA Y15, 256(SP)

	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 11, 12, 5, 15, 8, 0, 2, 13, 10, 3, 7, 9, 14, 6, 1, 4)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 7, 3, 13, 11, 9, 1, 12, 14, 2, 5, 4, 15, 6, 10, 0, 8)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 9, 5, 2, 10, 0, 7, 4, 15, 14, 11, 6, 3, 1, 12, 8, 13)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 2, 6, 0, 8, 12, 10, 11, 3, 4, 7, 15, 1, 13, 5, 14, 9)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 12, 1, 14, 4, 5, 15, 13, 10, 0, 6, 9, 8, 7, 3, 2, 11)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 13, 7, 12, 3, 11, 14, 1, 9, 5, 15, 8, 2, 0, 4, 6, 10)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 6, 14, 11, 0, 15, 9, 3, 8, 12, 13, 1, 10, 2, 7, 4, 5)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)
	LOAD_MSG(SI, 10, 8, 7, 1, 2, 4, 6, 5, 15, 9, 3, 13, 11, 14, 12, 0)
	ROUND(Y12, Y13, Y14, Y15, Y10, Y4, Y5)

	ROUND(32(SP), 64(SP), 96(SP), 128(SP), Y10, Y4, Y5)
	ROUND(160(SP), 192(SP), 224(SP), 256(SP), Y10, Y4, Y5)

	VPXOR Y0, Y8, Y8
	VPXOR Y1, Y9, Y9
	VPXOR Y2, Y8, Y8
	VPXOR Y3, Y9, Y9

	LEAQ 128(SI), SI
	SUBQ $128, DI
	JNE  loop

	MOVQ R8, 0(BX)
	MOVQ R9, 8(BX)

	VMOVDQU Y8, 0(AX)
	VMOVDQU Y9, 32(AX)

	MOVQ DX, SP
	RET

// func supportAVX2() bool
TEXT ·supportAVX2(SB), 4, $0-1
	MOVQ runtime·support_avx2(SB), AX
	MOVB AX, ret+0(FP)
	RET
