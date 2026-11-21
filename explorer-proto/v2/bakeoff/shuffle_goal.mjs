#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Deterministic word shuffle of a charter goal (the bias-ablation variant).
//   node shuffle_goal.mjs --goals <goals.json> --feature F1
// goals.json: {"F1": {"original": "...", "paraphrased": "..."}, ...}. Prints the shuffled goal on one line.
// Algorithm (frozen): split the original on whitespace; seed = FNV-1a 32-bit of "<feature>\n<original>";
// PRNG = mulberry32(seed); Fisher-Yates from the last index down; join with single spaces.
import {isMain, parseArgs, readJson} from './common.mjs';

export function fnv1a32(text) {
    let hash = 0x811c9dc5;
    for (const byte of Buffer.from(text, 'utf8')) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffleGoal(feature, original) {
    const words = original.split(/\s+/).filter(Boolean);
    const random = mulberry32(fnv1a32(`${feature}\n${original}`));
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }
    return words.join(' ');
}

if (isMain(import.meta.url)) {
    const {flags} = parseArgs(process.argv.slice(2));
    try {
        const original = readJson(flags.goals)[flags.feature]?.original;
        if (!original) {
            throw new Error(
                'usage: shuffle_goal.mjs --goals <goals.json> --feature F1 (feature needs an "original" goal)',
            );
        }
        process.stdout.write(`${shuffleGoal(flags.feature, original)}\n`);
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        process.exitCode = 2;
    }
}
