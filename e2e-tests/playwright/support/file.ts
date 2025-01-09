// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';
import fs from 'node:fs';

/**
 * Reads file data and creates a File object.
 * @param filePath - The path to the file.
 * @param fileType - The MIME type of the file.
 * @returns A File object containing the file data.
 * @throws If the file does not exist.
 */
export function getFileData(filePath: string, fileType: string): File {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    return new File([fileBuffer], fileName, {type: fileType});
}

/**
 * Reads file data from the "asset" directory and creates a File object.
 * @param filename - The name of the file in the "asset" directory.
 * @param fileType - The MIME type of the file.
 * @returns A File object containing the file data.
 */
export function getFileDataFromAsset(filename: string, fileType: string): File {
    const assetPath = path.resolve(__dirname, 'asset');
    const filePath = path.join(assetPath, filename);

    return getFileData(filePath, fileType);
}
