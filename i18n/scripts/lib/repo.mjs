// A repository's files, read through a tree: read() returns a file's text, or
// null if it does not exist; list() returns the file names in a directory.
import fs from 'fs';
import path from 'path';

/** The working tree under root. */
export function workingTree(root) {
    return {
        read(rel) {
            try {
                return fs.readFileSync(path.join(root, rel), 'utf8');
            } catch (e) {
                if (e.code === 'ENOENT') {
                    return null;
                }
                throw e;
            }
        },
        list(relDir) {
            try {
                return fs.readdirSync(path.join(root, relDir), {withFileTypes: true}).
                    filter((entry) => entry.isFile()).
                    map((entry) => entry.name).
                    sort();
            } catch (e) {
                if (e.code === 'ENOENT') {
                    return [];
                }
                throw e;
            }
        },
    };
}
