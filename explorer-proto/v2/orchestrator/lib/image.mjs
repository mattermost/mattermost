// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-process-env -- MATTERMOST_PILOT_IMAGE is the compose variable of infra/docker-compose.yml */

// The image override of a headless run: `--image <ref@sha256:digest>` or the environment variable
// MATTERMOST_PILOT_IMAGE (the variable infra/docker-compose.yml already reads). A reference without a digest is refused.

export const IMAGE_ENV = 'MATTERMOST_PILOT_IMAGE';

const WITH_DIGEST = /^([^\s@]+)@(sha256:[0-9a-f]{64})$/;
const TAGGED = /^[a-z0-9][a-z0-9._/-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Throws a usage message unless value is `<repository>[:<tag>]@sha256:<64 hex>`. */
export function parseImage(value, source) {
    const m = WITH_DIGEST.exec(String(value));
    if (!m) {
        throw new Error(
            `${source} must be an image reference with a sha256 digest (<repository>[:<tag>]@sha256:<hex>)`,
        );
    }
    const [, named, digest] = m;
    const ref = TAGGED.test(named) ? named : `${named.replace(/:[^/]*$/, '')}:by-digest`;
    if (!TAGGED.test(ref)) {
        throw new Error(`${source} names an invalid repository`);
    }
    return {reference: `${named}@${digest}`, ref, digest};
}

/** The override from --image, else from the environment; null when neither is set. */
export function imageOverride(flagValue, env = process.env) {
    if (flagValue !== undefined) {
        return parseImage(flagValue, '--image');
    }
    if (env[IMAGE_ENV]) {
        return parseImage(env[IMAGE_ENV], IMAGE_ENV);
    }
    return null;
}
