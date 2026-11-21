// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import crypto from 'node:crypto';

export type Frame = {fin: boolean; opcode: number; payload: Buffer};

export const OPCODE = {continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa} as const;

/** Incremental RFC 6455 frame parser (no extensions; masked frames are unmasked). */
export class FrameParser {
    private buffer: Buffer = Buffer.alloc(0);

    push(chunk: Buffer): Frame[] {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const frames: Frame[] = [];
        for (;;) {
            const frame = this.next();
            if (!frame) {
                return frames;
            }
            frames.push(frame);
        }
    }

    private next(): Frame | null {
        const b = this.buffer;
        if (b.length < 2) {
            return null;
        }
        const fin = (b[0] & 0x80) !== 0;
        const opcode = b[0] & 0x0f;
        const masked = (b[1] & 0x80) !== 0;
        let length = b[1] & 0x7f;
        let offset = 2;
        if (length === 126) {
            if (b.length < 4) {
                return null;
            }
            length = b.readUInt16BE(2);
            offset = 4;
        } else if (length === 127) {
            if (b.length < 10) {
                return null;
            }
            length = Number(b.readBigUInt64BE(2));
            offset = 10;
        }
        const maskLength = masked ? 4 : 0;
        if (b.length < offset + maskLength + length) {
            return null;
        }
        const mask = masked ? b.subarray(offset, offset + 4) : null;
        const payload = Buffer.from(b.subarray(offset + maskLength, offset + maskLength + length));
        if (mask) {
            for (let i = 0; i < payload.length; i++) {
                payload[i] ^= mask[i % 4];
            }
        }
        this.buffer = b.subarray(offset + maskLength + length);
        return {fin, opcode, payload};
    }
}

export function encodeFrame(opcode: number, payload: Buffer, options: {mask?: boolean; fin?: boolean} = {}): Buffer {
    const fin = options.fin ?? true;
    const mask = options.mask ?? false;
    const head: number[] = [(fin ? 0x80 : 0) | opcode];
    const maskBit = mask ? 0x80 : 0;
    if (payload.length < 126) {
        head.push(maskBit | payload.length);
    } else if (payload.length < 65536) {
        head.push(maskBit | 126, (payload.length >> 8) & 0xff, payload.length & 0xff);
    } else {
        const extended = Buffer.alloc(8);
        extended.writeBigUInt64BE(BigInt(payload.length));
        head.push(maskBit | 127, ...extended);
    }
    if (!mask) {
        return Buffer.concat([Buffer.from(head), payload]);
    }
    const key = crypto.randomBytes(4);
    const body = Buffer.from(payload);
    for (let i = 0; i < body.length; i++) {
        body[i] ^= key[i % 4];
    }
    return Buffer.concat([Buffer.from(head), key, body]);
}

/** Reassembles fragmented data messages; control frames are returned as they arrive. */
export class MessageAssembler {
    private parts: Buffer[] = [];
    private opcode = 0;

    push(frame: Frame): {opcode: number; payload: Buffer} | null {
        if (frame.opcode >= 0x8) {
            return {opcode: frame.opcode, payload: frame.payload};
        }
        if (frame.opcode !== OPCODE.continuation) {
            this.opcode = frame.opcode;
            this.parts = [];
        }
        this.parts.push(frame.payload);
        if (!frame.fin) {
            return null;
        }
        const payload = Buffer.concat(this.parts);
        this.parts = [];
        return {opcode: this.opcode, payload};
    }
}

export function acceptKey(clientKey: string): string {
    return crypto.createHash('sha1').update(`${clientKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
}
