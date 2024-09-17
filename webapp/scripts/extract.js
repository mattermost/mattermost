const {fork} = require('node:child_process');
const fs = require('node:fs');

const {extract} = require('@formatjs/cli-lib');
const {async: globAsync} = require('fast-glob');

const filePatterns = [
    'channels/src/**/*.ts',
    'channels/src/**/*.tsx',
    'channels/src/**/*.js',
    'channels/src/**/*.jsx',
];

const ignorePatterns = [
    '**/*.d.ts',
    '**/*.test.*',
];

async function wrapExtract() {
    const controller = new AbortController();

    const childProcess = fork(process.argv[1], ['do-extract'], {
        signal: controller.signal,
        stdio: [0, 1, 'pipe', 'ipc'],
    });

    const errOutput = [];
    childProcess.stderr.on('data', (data) => {
        errOutput.push(data);
    });

    let exitCode = 0;
    try {
        exitCode = await new Promise((resolve) => {
            childProcess.on('exit', (code) => {
                resolve(code);
            });
        });
    } catch (e) {
        console.error('Failed to wait for child process to exit', e);
    }

    if (errOutput.length > 0) {
        console.error(Buffer.concat(errOutput).toString());

        exitCode = exitCode || 1;
    }

    return exitCode;
}

async function doExtract() {
    const files = await globAsync(filePatterns, {
        ignore: ignorePatterns,
    });

    const messages = await extract(files, {
        format: 'simple',
    });

    fs.writeFileSync('result.json', messages);
}

if (process.argv.length === 3 && process.argv[2] === 'do-extract') {
    doExtract();
} else {
    wrapExtract().then((exitCode) => {
        process.exit(exitCode);
    });
}
