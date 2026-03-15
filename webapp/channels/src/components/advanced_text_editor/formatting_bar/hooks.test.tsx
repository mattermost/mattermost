// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {splitFormattingBarControls} from './hooks';

describe('splitFormattingBarControls', () => {
    describe('Center channel - without additional controls', () => {
        test('wide mode shows all 9 controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 0, false);
            expect(controls).toHaveLength(9);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol']);
            expect(hiddenControls).toHaveLength(0);
        });

        test('normal mode shows 5 controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('normal', 0, false);
            expect(controls).toHaveLength(5);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link']);
            expect(hiddenControls).toHaveLength(4);
            expect(hiddenControls).toEqual(['code', 'quote', 'ul', 'ol']);
        });

        test('narrow mode shows 3 controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 0, false);
            expect(controls).toHaveLength(3);
            expect(controls).toEqual(['bold', 'italic', 'strike']);
            expect(hiddenControls).toHaveLength(6);
        });

        test('min mode shows 1 control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('min', 0, false);
            expect(controls).toHaveLength(1);
            expect(controls).toEqual(['bold']);
            expect(hiddenControls).toHaveLength(8);
        });
    });

    describe('Center channel - with additional controls', () => {
        test('wide mode reduces to 7 controls with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 1, false);
            expect(controls).toHaveLength(7);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote']);
            expect(hiddenControls).toHaveLength(2);
            expect(hiddenControls).toEqual(['ul', 'ol']);
        });

        test('wide mode reduces to 7 controls with 2+ additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 2, false);
            expect(controls).toHaveLength(7);
            expect(hiddenControls).toHaveLength(2);
        });

        test('normal mode reduces to 3 controls with 1 additional control', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('normal', 1, false);
            expect(controls).toHaveLength(3);
            expect(controls).toEqual(['bold', 'italic', 'strike']);
            expect(hiddenControls).toHaveLength(6);
        });

        test('narrow mode keeps 3 controls with only 1 additional control (special case)', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 1, false);
            expect(controls).toHaveLength(3);
            expect(controls).toEqual(['bold', 'italic', 'strike']);
            expect(hiddenControls).toHaveLength(6);
        });

        test('narrow mode reduces to 1 control with 2+ additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 2, false);
            expect(controls).toHaveLength(1);
            expect(controls).toEqual(['bold']);
            expect(hiddenControls).toHaveLength(8);
        });

        test('min mode hides all controls with additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('min', 1, false);
            expect(controls).toHaveLength(0);
            expect(controls).toEqual([]);
            expect(hiddenControls).toHaveLength(9);
        });
    });

    describe('RHS - without additional controls', () => {
        test('RHS wide mode shows all 9 controls when no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 0, true);
            expect(controls).toHaveLength(9);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol']);
            expect(hiddenControls).toHaveLength(0);
        });

        test('RHS normal mode shows 5 controls when no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('normal', 0, true);
            expect(controls).toHaveLength(5);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link']);
            expect(hiddenControls).toHaveLength(4);
        });

        test('RHS narrow mode shows 3 controls when no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 0, true);
            expect(controls).toHaveLength(3);
            expect(controls).toEqual(['bold', 'italic', 'strike']);
            expect(hiddenControls).toHaveLength(6);
        });

        test('RHS min mode shows 1 control when no additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('min', 0, true);
            expect(controls).toHaveLength(1);
            expect(controls).toEqual(['bold']);
            expect(hiddenControls).toHaveLength(8);
        });
    });

    describe('RHS - with additional controls (different from center)', () => {
        test('RHS wide mode reduces to 7 controls with additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('wide', 1, true);
            expect(controls).toHaveLength(7);
            expect(controls).toEqual(['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote']);
            expect(hiddenControls).toHaveLength(2);
            expect(hiddenControls).toEqual(['ul', 'ol']);
        });

        test('RHS normal mode reduces to 3 controls with additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('normal', 1, true);
            expect(controls).toHaveLength(3);
            expect(controls).toEqual(['bold', 'italic', 'strike']);
            expect(hiddenControls).toHaveLength(6);
        });

        test('RHS narrow mode reduces to 1 control with 1 additional control (different from center!)', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 1, true);
            expect(controls).toHaveLength(1);
            expect(controls).toEqual(['bold']);
            expect(hiddenControls).toHaveLength(8);
        });

        test('RHS narrow mode reduces to 1 control with 2+ additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('narrow', 2, true);
            expect(controls).toHaveLength(1);
            expect(controls).toEqual(['bold']);
            expect(hiddenControls).toHaveLength(8);
        });

        test('RHS min mode hides all controls with additional controls', () => {
            const {controls, hiddenControls} = splitFormattingBarControls('min', 1, true);
            expect(controls).toHaveLength(0);
            expect(controls).toEqual([]);
            expect(hiddenControls).toHaveLength(9);
        });
    });

    describe('Key behavioral differences between Center and RHS', () => {
        test('Center narrow mode with 1 additional control keeps 3 icons (special case)', () => {
            const center = splitFormattingBarControls('narrow', 1, false);
            expect(center.controls).toHaveLength(3);
        });

        test('RHS narrow mode with 1 additional control shows only 1 icon (always reduces)', () => {
            const rhs = splitFormattingBarControls('narrow', 1, true);
            expect(rhs.controls).toHaveLength(1);
        });

        test('Both center and RHS use same reduction pattern when additional controls present', () => {
            // Wide mode
            const centerWide = splitFormattingBarControls('wide', 2, false);
            const rhsWide = splitFormattingBarControls('wide', 2, true);
            expect(centerWide.controls).toHaveLength(7);
            expect(rhsWide.controls).toHaveLength(7);

            // Normal mode
            const centerNormal = splitFormattingBarControls('normal', 2, false);
            const rhsNormal = splitFormattingBarControls('normal', 2, true);
            expect(centerNormal.controls).toHaveLength(3);
            expect(rhsNormal.controls).toHaveLength(3);

            // Min mode
            const centerMin = splitFormattingBarControls('min', 2, false);
            const rhsMin = splitFormattingBarControls('min', 2, true);
            expect(centerMin.controls).toHaveLength(0);
            expect(rhsMin.controls).toHaveLength(0);
        });
    });
});
