// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {readJourneyCharter} from './journey_charter.ts';
import {PLAYWRIGHT_SPECS_DIR} from './paths.ts';

// The emitted repo-native spec lives beside the existing channel notification specs (same modal family
// as channel_mentions.spec.ts). Its stem is derived from the charter journey id, not hand-written.
export const JOURNEY_SPEC_SUBDIR = path.join('functional', 'channels', 'notifications');

export function journeySpecStem(journeyId: string): string {
    const afterColon = journeyId.includes(':') ? journeyId.slice(journeyId.indexOf(':') + 1) : journeyId;
    return `channel_${afterColon.replace(/[^a-z0-9]+/g, '_')}`;
}

export function journeySpecLocation(journey: string): {
    dir: string;
    file: string;
    absolute: string;
} {
    const charter = readJourneyCharter(journey);
    const dir = path.join(PLAYWRIGHT_SPECS_DIR, JOURNEY_SPEC_SUBDIR);
    const file = `${journeySpecStem(charter.journey_id)}.spec.ts`;
    return {dir, file, absolute: path.join(dir, file)};
}
