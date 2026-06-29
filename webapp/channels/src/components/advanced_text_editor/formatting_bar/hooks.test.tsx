// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LayoutModes, splitFormattingBarControls} from './hooks';

describe('splitFormattingBarControls', () => {
    describe('wide mode — always shows all 9 icons regardless of additional controls', () => {
        test('shows all 9 with no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Wide, 0, false);
            expect(controls).toHaveLength(9);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol']);
            expect(hiddenControls).toHaveLength(0);
        });

        test('shows all 9 with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Wide, 1, false);
            expect(controls).toHaveLength(9);
            expect(hiddenControls).toHaveLength(0);
        });

        test('shows all 9 with 3 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Wide, 3, false);
            expect(controls).toHaveLength(9);
            expect(hiddenControls).toHaveLength(0);
        });
    });

    describe('normal mode (base 5) — first additional control is free, each one after reduces by 1', () => {
        test('shows 5 with no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 0, false);
            expect(controls).toHaveLength(5);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link']);
            expect(hiddenControls).toHaveLength(4);
        });

        test('shows 5 with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 1, false);
            expect(controls).toHaveLength(5);
            expect(hiddenControls).toHaveLength(4);
        });

        test('shows 4 with 2 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 2, false);
            expect(controls).toHaveLength(4);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading']);
            expect(hiddenControls).toHaveLength(5);
        });

        test('shows 3 with 3 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 3, false);
            expect(controls).toHaveLength(3);
            expect(controls).toEqual(['bold', 'italic', 'strike']);
            expect(hiddenControls).toHaveLength(6);
        });

        test('shows 2 with 4 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 4, false);
            expect(controls).toHaveLength(2);
            expect(hiddenControls).toHaveLength(7);
        });
    });

    describe('narrow mode (base 2) — first additional control is free, each one after reduces by 1', () => {
        test('shows 2 with no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Narrow, 0, false);
            expect(controls).toHaveLength(2);
            expect(controls).toEqual(['bold', 'italic']);
            expect(hiddenControls).toHaveLength(7);
        });

        test('shows 2 with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Narrow, 1, false);
            expect(controls).toHaveLength(2);
            expect(hiddenControls).toHaveLength(7);
        });

        test('shows 1 with 2 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Narrow, 2, false);
            expect(controls).toHaveLength(1);
            expect(controls).toEqual(['bold']);
            expect(hiddenControls).toHaveLength(8);
        });

        test('shows 0 with 3 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Narrow, 3, false);
            expect(controls).toHaveLength(0);
            expect(hiddenControls).toHaveLength(9);
        });
    });

    describe('min mode (base 1) — first additional control is free, each one after reduces by 1', () => {
        test('shows 1 with no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Min, 0, false);
            expect(controls).toHaveLength(1);
            expect(controls).toEqual(['bold']);
            expect(hiddenControls).toHaveLength(8);
        });

        test('shows 0 with 2 additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Min, 2, false);
            expect(controls).toHaveLength(0);
            expect(hiddenControls).toHaveLength(9);
        });
    });

    describe('RHS — each additional control reduces by 1 (tighter space, no free slot)', () => {
        test('wide mode keeps all 9 regardless of additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Wide, 3, true);
            expect(controls).toHaveLength(9);
            expect(hiddenControls).toHaveLength(0);
        });

        test('normal with 1 additional shows 4', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 1, true);
            expect(controls).toHaveLength(4);
            expect(hiddenControls).toHaveLength(5);
        });

        test('normal with 2 additional shows 3', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 2, true);
            expect(controls).toHaveLength(3);
            expect(hiddenControls).toHaveLength(6);
        });

        test('normal with 3 additional shows 2', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Normal, 3, true);
            expect(controls).toHaveLength(2);
            expect(hiddenControls).toHaveLength(7);
        });

        test('narrow with 1 additional shows 1', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Narrow, 1, true);
            expect(controls).toHaveLength(1);
            expect(hiddenControls).toHaveLength(8);
        });

        test('narrow with 2 additional shows 0', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Narrow, 2, true);
            expect(controls).toHaveLength(0);
            expect(hiddenControls).toHaveLength(9);
        });

        test('min with 1 additional shows 0', () => {
            const {controls, hiddenControls} = splitFormattingBarControls(LayoutModes.Min, 1, true);
            expect(controls).toHaveLength(0);
            expect(hiddenControls).toHaveLength(9);
        });
    });
});
