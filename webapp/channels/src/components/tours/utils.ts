// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FINISHED} from './constant';

export type ActionType = 'next' | 'prev' | 'dismiss' | 'jump' | 'skipped'

export interface ChannelsTourTipManager {
    show: boolean;
    currentStep: number;
    tourSteps: Record<string, number>;
    handleOpen: (e: React.MouseEvent) => void;
    handleSkip: (e: React.MouseEvent) => void;
    handleDismiss: (e: React.MouseEvent) => void;
    handlePrevious: (e: React.MouseEvent) => void;
    handleNext: (e: React.MouseEvent) => void;
    handleJump: (e: React.MouseEvent, jumpStep: number) => void;
}

export const KeyCodes: Record<string, [string, number]> = {
    ENTER: ['Enter', 13],
    COMPOSING: ['Composing', 229],
};

// This is extracted from utils file to remove dependency on utils file of webapp
export function isKeyPressed(event: KeyboardEvent, key: [string, number]): boolean {
    // There are two types of keyboards
    // 1. English with different layouts (Dvorak for example)
    // 2. Different language keyboards (Russian for example)

    if (event.keyCode === KeyCodes.COMPOSING[1]) {
        return false;
    }

    // checks for event.key for older browsers and also for the case of different English layout keyboards.
    if (typeof event.key !== 'undefined' && event.key !== 'Unidentified' && event.key !== 'Dead') {
        const isPressedByCode = event.key === key[0] || event.key === key[0].toUpperCase();
        if (isPressedByCode) {
            return true;
        }
    }

    // used for different language keyboards to detect the position of keys
    return event.keyCode === key[1];
}

export const getLastStep = (Steps: Record<string, number>) => {
    return Object.values(Steps).reduce((maxStep, candidateMaxStep) => {
        // ignore the "opt out" FINISHED step as the max step.
        if (candidateMaxStep > maxStep && candidateMaxStep !== FINISHED) {
            return candidateMaxStep;
        }
        return maxStep;
    }, Number.MIN_SAFE_INTEGER);
};
