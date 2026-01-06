// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';
import fs from 'node:fs';

import mime from 'mime-types';

import {resolvePlaywrightPath} from './util';

const commonAssetPath = path.resolve(__dirname, 'asset');
export const assetPath = resolvePlaywrightPath('asset');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const availableFiles = ['mattermost-icon_128x128.png'] as const;
type AvailableFilename = (typeof availableFiles)[number];

/**
 * Reads file data and creates a File object.
 * @param filePath - The path to the file.
 * @returns A File object containing the file data.
 * @throws If the file does not exist.
 */
export function getFileData(filePath: string): File {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }

    const mimeType = mime.lookup(filePath) || undefined;
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    return new File([fileBuffer], fileName, {type: mimeType});
}

/**
 * Reads file data and creates a Blob object.
 * @param filePath - The path to the file.
 * @returns A Blob object containing the file data.
 * @throws If the file does not exist.
 */
export function getBlobData(filePath: string): Blob {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }

    const mimeType = mime.lookup(filePath) || undefined;
    const fileBuffer = fs.readFileSync(filePath);

    return new Blob([fileBuffer], {type: mimeType});
}

/**
 * Reads file data from the "asset" directory and creates a File object.
 * @param filename - The name of the file in the "asset" directory.
 * @returns An object containing a File object
 */
export function getFileFromAsset(filename: string) {
    const filePath = path.join(assetPath, filename);

    return getFileData(filePath);
}

/**
 * Reads file data from the "asset" directory and creates a Blob object.
 * @param filename - The name of the file in the "asset" directory.
 * @returns An object containing a Blob object
 */
export function getBlobFromAsset(filename: string) {
    const filePath = path.join(assetPath, filename);

    return getBlobData(filePath);
}

/**
 * Reads file data from the lib "asset" directory and creates a File object.
 * @param filename - The name of the file in the "asset" directory.
 * @returns An object containing a File object
 */
export function getFileFromCommonAsset(filename: AvailableFilename) {
    const filePath = path.join(commonAssetPath, filename);

    return getFileData(filePath);
}

/**
 * Reads file data from the lib "asset" directory and creates a Blob object.
 * @param filename - The name of the file in the "asset" directory.
 * @returns An object containing a Blob object
 */
export function getBlobFromCommonAsset(filename: AvailableFilename) {
    const filePath = path.join(commonAssetPath, filename);

    return getBlobData(filePath);
}
