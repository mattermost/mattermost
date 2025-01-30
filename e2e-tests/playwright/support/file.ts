// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';
import fs from 'node:fs';

const assetPath = path.resolve(__dirname, 'asset');

/**
 * Reads file data and creates a File object.
 * @param filePath - The path to the file.
 * @param mimeType - The MIME type of the file.
 * @returns A File object containing the file data.
 * @throws If the file does not exist.
 */
export function getFileData(filePath: string, mimeType: string): File {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    return new File([fileBuffer], fileName, {type: mimeType});
}

/**
 * Reads file data from the "asset" directory and creates a File object.
 * @param filename - The name of the file in the "asset" directory.
 * @param mimeType - The MIME type of the file.
 * @returns An object containing a File object and the filename.
 */
export function getFileDataFromAsset(filename: string, mimeType: string) {
    const filePath = path.join(assetPath, filename);

    return {file: getFileData(filePath, mimeType), filename: path.basename(filePath)};
}

/**
 * Reads file data and creates a Blob object.
 * @param filePath - The path to the file.
 * @param mimeType - The MIME type of the file.
 * @returns A Blob object containing the file data.
 * @throws If the file does not exist.
 */
export function getBlobData(filePath: string, mimeType: string): Blob {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }
    const fileBuffer = fs.readFileSync(filePath);

    return new Blob([fileBuffer], {type: mimeType});
}

/**
 * Reads file data from the "asset" directory and creates a Blob object.
 * @param filename - The name of the file in the "asset" directory.
 * @param mimeType - The MIME type of the file.
 * @returns An object containing a Blob object and the filename.
 */
export function getBlobDataFromAsset(filename: string, mimeType: string) {
    const filePath = path.join(assetPath, filename);

    return {blob: getBlobData(filePath, mimeType), filename: path.basename(filePath)};
}
