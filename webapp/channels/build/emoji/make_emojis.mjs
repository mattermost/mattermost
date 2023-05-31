// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/*
* This script will generate the emoji files for both the webapp and server to use emojis from 'emoji-datasource' npm package
* It will generate the following files:
* '<rootDir>/webapp/channels/src/utils/emoji.ts'
* '<rootDir>/webapp/channels/src/sass/components/_emojisprite.scss'
* '<rootDir>/webapp/channels/src/utils/emoji.json'
* '<rootDir>/server/public/model/emoji_data.go',
*
* For help on how to use this script, run:
* npm run make-emojis -- --help
*/

import path from 'node:path';
import * as fsPromise from 'node:fs/promises';
import * as fs from 'node:fs';
import * as url from 'node:url';

import yargs from 'yargs';
import chalk from 'chalk';
import jsonData from 'emoji-datasource/emoji.json';
import jsonCategories from 'emoji-datasource/categories.json';

import additionalShortnames from './additional_shortnames.json';

const EMOJI_SIZE = 64;
const EMOJI_SIZE_PADDED = EMOJI_SIZE + 2; // 1px per side
const EMOJI_DEFAULT_SKIN = 'default';
const endResults = [];

const currentDir = path.dirname(url.fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..', '..', '..', '..');
const serverRootDir = path.resolve(rootDir, 'server');
const webappRootDir = path.resolve(rootDir, 'webapp');

const argv = yargs(process.argv.slice(1)).
    scriptName('make-emojis').
    usage('Usage : npm run $0 -- [args]').
    example('npm run $0 -- --excluded-emoji-file ./excludedEmojis.txt', 'removes mentioned emojis from the app').
    option('excluded-emoji-file', {
        description: 'Path to a file containing emoji short names to exclude',
        type: 'string',
    }).
    help().
    epilog('Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.').
    argv;

const argsExcludedEmojiFile = argv['excluded-emoji-file'];

function log(level = '', text) {
    if (level === 'info') {
        // eslint-disable-next-line no-console
        console.log(chalk.cyan(`[INFO]: ${text}`));
    } else if (level === 'warn') {
        // eslint-disable-next-line no-console
        console.log(chalk.yellow(`[WARN]: ${text}`));
    } else if (level === 'error') {
        // eslint-disable-next-line no-console
        console.error(chalk.red(`[ERRO]: ${text}`));
    } else if (level === 'success') {
        // eslint-disable-next-line no-console
        console.log(chalk.green(`[SUCC]: ${text}`));
    } else {
        // eslint-disable-next-line no-console
        console.log(text);
    }
}

function writeToFileAndPrint(fileName, filePath, data) {
    const promise = fsPromise.writeFile(filePath, data, writeOptions);

    promise.then(() => {
        log('info', `"${fileName}" generated successfully in "${filePath}"`);
    }).catch((err) => {
        log('error', `Failed to generate "${fileName}": ${err}`);
    });

    return promise;
}

function copyFileAndPrint(source, destination, fileName, print = true) {
    const promise = fsPromise.copyFile(source, destination);

    promise.then(() => {
        if (print) {
            log('info', `"${fileName}" copied successfully to "${destination}"`);
        }
    }).catch((err) => {
        log('error', `Failed to copy "${fileName}": ${err}`);
    });

    return promise;
}

function normalizeCategoryName(category) {
    return category.toLowerCase().replace(' & ', '-');
}

// Copy emoji images from 'emoji-datasource-apple'
const emojiDataSourceDir = path.resolve(webappRootDir, `node_modules/emoji-datasource-apple/img/apple/${EMOJI_SIZE}/`);
const emojiImagesDir = path.resolve(webappRootDir, 'channels', 'src', 'images', 'emoji');
const readDirPromise = fsPromise.readdir(emojiDataSourceDir);
endResults.push(readDirPromise);
readDirPromise.then((images) => {
    for (const imageFile of images) {
        endResults.push(copyFileAndPrint(path.join(emojiDataSourceDir, imageFile), path.join(emojiImagesDir, imageFile), imageFile, false));
    }
});

// Missing emojis from Apple emoji set ["medical_symbol", "male_sign", and "female_sign"]
// @see https://github.com/iamcal/emoji-data#image-sources
const missingEmojis = ['2640-fe0f', '2642-fe0f', '2695-fe0f'];

// Copy the missing from google emoji set
const missingEmojiDataSourceDir = path.resolve(webappRootDir, `node_modules/emoji-datasource-google/img/google/${EMOJI_SIZE}/`);
const readMissingDirPromise = fsPromise.readdir(missingEmojiDataSourceDir);
endResults.push(readMissingDirPromise);
readMissingDirPromise.then(() => {
    for (const missingEmoji of missingEmojis) {
        endResults.push(
            copyFileAndPrint(path.join(missingEmojiDataSourceDir, `${missingEmoji}.png`), path.join(emojiImagesDir, `${missingEmoji}.png`), `Missed ${missingEmoji}`));
    }
});

// Copy mattermost emoji image
const webappImagesDir = path.resolve(webappRootDir, 'channels', 'src', 'images');
endResults.push(copyFileAndPrint(path.resolve(webappImagesDir, 'icon64x64.png'), path.resolve(webappImagesDir, 'emoji/mattermost.png'), 'mattermost-emoji'));

const sheetSource = path.resolve(webappRootDir, `node_modules/emoji-datasource-apple/img/apple/sheets/${EMOJI_SIZE}.png`);
const sheetAbsoluteFile = path.resolve(webappRootDir, 'channels', 'src', 'images/emoji-sheets/apple-sheet.png');
const sheetFile = 'images/emoji-sheets/apple-sheet.png';

// Copy sheet image
endResults.push(copyFileAndPrint(sheetSource, sheetAbsoluteFile, 'emoji-sheet'));

// we'll load it as a two dimensional array so we can generate a Map out of it
const emojiIndicesByAlias = [];
const emojiIndicesByUnicode = [];
const emojiIndicesByCategory = new Map();
const emojiIndicesByCategoryAndSkin = new Map();
const emojiIndicesByCategoryNoSkin = new Map();
const categoryNamesSet = new Set();
const categoryDefaultTranslation = new Map();
const emojiImagesByAlias = [];
const emojiFilePositions = new Map();
const skinCodes = {
    '1F3FB': 'light_skin_tone',
    '1F3FC': 'medium_light_skin_tone',
    '1F3FD': 'medium_skin_tone',
    '1F3FE': 'medium_dark_skin_tone',
    '1F3FF': 'dark_skin_tone',
    default: 'default',
};
const skinNames = {
    '1F3FB': 'LIGHT SKIN TONE',
    '1F3FC': 'MEDIUM LIGHT SKIN TONE',
    '1F3FD': 'MEDIUM SKIN TONE',
    '1F3FE': 'MEDIUM DARK SKIN TONE',
    '1F3FF': 'DARK SKIN TONE',
};
const control = new AbortController();
const writeOptions = {
    encoding: 'utf8',
    signal: control.signal,
};

// Extract excluded emoji shortnames as an array
const excludedEmoji = [];
if (argsExcludedEmojiFile) {
    fs.readFileSync(path.normalize(argsExcludedEmojiFile), 'utf-8').split(/\r?\n/).forEach((line) => {
        excludedEmoji.push(line);
    });
    log('warn', `[WARNING] The following emoji(s) will be excluded from the webapp: \n${excludedEmoji}\n`);
}

// Remove unwanted emoji
const filteredEmojiJson = jsonData.filter((element) => !excludedEmoji.some((e) => element.short_names.includes(e)));

function generateEmojiSkinVariations(emoji) {
    if (!emoji.skin_variations) {
        return [];
    }
    return Object.keys(emoji.skin_variations).map((skinCode) => {
        // if skin codes ever change this will produce a null_light_skin_tone
        const skins = skinCode.split('-');
        const skinShortName = skins.map((code) => skinCodes[code]).join('_');
        const skinName = skins.map((code) => skinNames[code]).join(', ');
        const variation = {...emoji.skin_variations[skinCode]};
        variation.short_name = `${emoji.short_name}_${skinShortName}`;
        variation.short_names = emoji.short_names.map((alias) => `${alias}_${skinShortName}`);
        variation.name = `${emoji.name}: ${skinName}`;
        variation.category = emoji.category;
        variation.skins = skins;
        return variation;
    });
}

// populate skin tones as full emojis
const fullEmoji = [...filteredEmojiJson];
filteredEmojiJson.forEach((emoji) => {
    const variations = generateEmojiSkinVariations(emoji);
    fullEmoji.push(...variations);
});

// add old shortnames to maintain backwards compatibility with gemoji
fullEmoji.forEach((emoji) => {
    if (emoji.short_name in additionalShortnames) {
        emoji.short_names.push(...additionalShortnames[emoji.short_name]);
    }
});

// add built-in custom emojis
fullEmoji.push({
    id: 'mattermost',
    name: 'Mattermost',
    unified: '',
    image: 'mattermost.png',
    short_name: 'mattermost',
    short_names: ['mattermost'],
    category: 'custom',
});

fullEmoji.sort((emojiA, emojiB) => emojiA.sort_order - emojiB.sort_order);

function addIndexToMap(emojiMap, key, ...indexes) {
    const newList = emojiMap.get(key) || [];
    newList.push(...indexes);
    emojiMap.set(key, newList);
}

const skinset = new Set();
fullEmoji.forEach((emoji, index) => {
    if (emoji.unified) {
        emojiIndicesByUnicode.push([emoji.unified.toLowerCase(), index]);
    }

    const safeCat = normalizeCategoryName(emoji.category);
    categoryDefaultTranslation.set(safeCat, emoji.category);
    emoji.category = safeCat;
    addIndexToMap(emojiIndicesByCategory, safeCat, index);
    if (emoji.skins || emoji.skin_variations) {
        const skin = (emoji.skins && emoji.skins[0]) || EMOJI_DEFAULT_SKIN;
        skinset.add(skin);
        const categoryBySkin = emojiIndicesByCategoryAndSkin.get(skin) || new Map();
        addIndexToMap(categoryBySkin, safeCat, index);
        emojiIndicesByCategoryAndSkin.set(skin, categoryBySkin);
    } else {
        addIndexToMap(emojiIndicesByCategoryNoSkin, safeCat, index);
    }
    categoryNamesSet.add(safeCat);
    emojiIndicesByAlias.push(...emoji.short_names.map((alias) => [alias, index]));
    const file = emoji.image.split('.')[0];
    emoji.fileName = emoji.image;
    emoji.image = file;

    if (emoji.category !== 'custom') {
        let x = emoji.sheet_x * EMOJI_SIZE_PADDED;
        if (x !== 0) {
            x += 'px';
        }
        let y = emoji.sheet_y * EMOJI_SIZE_PADDED;
        if (y !== 0) {
            y += 'px';
        }
        emojiFilePositions.set(file, `-${x} -${y};`);
    }

    emojiImagesByAlias.push(...emoji.short_names.map((alias) => `"${alias}": "${file}"`));
});

function trimPropertiesFromEmoji(emoji) {
    if (emoji.hasOwnProperty('non_qualified')) {
        Reflect.deleteProperty(emoji, 'non_qualified');
    }

    if (emoji.hasOwnProperty('docomo')) {
        Reflect.deleteProperty(emoji, 'docomo');
    }

    if (emoji.hasOwnProperty('au')) {
        Reflect.deleteProperty(emoji, 'au');
    }

    if (emoji.hasOwnProperty('softbank')) {
        Reflect.deleteProperty(emoji, 'softbank');
    }

    if (emoji.hasOwnProperty('google')) {
        Reflect.deleteProperty(emoji, 'google');
    }

    if (emoji.hasOwnProperty('sheet_x')) {
        Reflect.deleteProperty(emoji, 'sheet_x');
    }

    if (emoji.hasOwnProperty('sheet_y')) {
        Reflect.deleteProperty(emoji, 'sheet_y');
    }

    if (emoji.hasOwnProperty('added_in')) {
        Reflect.deleteProperty(emoji, 'added_in');
    }

    if (emoji.hasOwnProperty('has_img_apple')) {
        Reflect.deleteProperty(emoji, 'has_img_apple');
    }

    if (emoji.hasOwnProperty('has_img_google')) {
        Reflect.deleteProperty(emoji, 'has_img_google');
    }

    if (emoji.hasOwnProperty('has_img_twitter')) {
        Reflect.deleteProperty(emoji, 'has_img_twitter');
    }

    if (emoji.hasOwnProperty('has_img_facebook')) {
        Reflect.deleteProperty(emoji, 'has_img_facebook');
    }

    if (emoji.hasOwnProperty('source_index')) {
        Reflect.deleteProperty(emoji, 'source_index');
    }

    if (emoji.hasOwnProperty('sort_order')) {
        Reflect.deleteProperty(emoji, 'sort_order');
    }

    if (emoji.hasOwnProperty('subcategory')) {
        Reflect.deleteProperty(emoji, 'subcategory');
    }

    if (emoji.hasOwnProperty('image')) {
        Reflect.deleteProperty(emoji, 'image');
    }

    if (emoji.hasOwnProperty('fileName')) {
        Reflect.deleteProperty(emoji, 'fileName');
    }

    return emoji;
}

// Removed properties that are not needed for the webapp
const trimmedDownEmojis = fullEmoji.map((emoji) => trimPropertiesFromEmoji(emoji));

// Create the emoji.json file
const webappUtilsEmojiDir = path.resolve(webappRootDir, 'channels', 'src', 'utils', 'emoji.json');
endResults.push(writeToFileAndPrint('emoji.json', webappUtilsEmojiDir, JSON.stringify(trimmedDownEmojis, null, 4)));

const categoryList = Object.keys(jsonCategories).filter((item) => item !== 'Component').map(normalizeCategoryName);
const categoryNames = ['recent', ...categoryList, 'custom'];
categoryDefaultTranslation.set('recent', 'Recently Used');
categoryDefaultTranslation.set('searchResults', 'Search Results');
categoryDefaultTranslation.set('custom', 'Custom');

const categoryTranslations = ['recent', 'searchResults', ...categoryNames].map((c) => `['${c}', t('emoji_picker.${c}')]`);
const writeableSkinCategories = [];
const skinTranslations = [];
const skinnedCats = [];
for (const skin of emojiIndicesByCategoryAndSkin.keys()) {
    writeableSkinCategories.push(`['${skin}', new Map(${JSON.stringify(Array.from(emojiIndicesByCategoryAndSkin.get(skin)))})]`);
    skinTranslations.push(`['${skin}', t('emoji_skin.${skinCodes[skin]}')]`);
    skinnedCats.push(`['${skin}', genSkinnedCategories('${skin}')]`);
}

// Generate contents of emoji.ts out of the emoji.json parsing we did earlier
const emojiJSX = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file is automatically generated via \`/webapp/channels/build/make_emojis.mjs\`. Do not modify it manually.

/* eslint-disable */

import {t} from 'utils/i18n';

import memoize from 'memoize-one';

import emojis from 'utils/emoji.json';

import spriteSheet from '${sheetFile}';

export const Emojis = emojis;

export const EmojiIndicesByAlias = new Map(${JSON.stringify(emojiIndicesByAlias)});

export const EmojiIndicesByUnicode = new Map(${JSON.stringify(emojiIndicesByUnicode)});

export const CategoryNames = ${JSON.stringify(categoryNames)};

export const CategoryMessage = new Map(${JSON.stringify(Array.from(categoryDefaultTranslation))});

export const CategoryTranslations = new Map([${categoryTranslations}]);

export const SkinTranslations = new Map([${skinTranslations.join(', ')}]);

export const ComponentCategory = 'Component';

const AllEmojiIndicesByCategory = new Map(${JSON.stringify(Array.from(emojiIndicesByCategory))});

const EmojiIndicesByCategoryAndSkin = new Map([${writeableSkinCategories.join(', ')}]);
const EmojiIndicesByCategoryNoSkin = new Map(${JSON.stringify(Array.from(emojiIndicesByCategoryNoSkin))});

const skinCodes = ${JSON.stringify(skinCodes)};

// Generate the list of indices that belong to each category by an specified skin
function genSkinnedCategories(skin: string) {
    const result = new Map();
    for (const cat of CategoryNames) {
        const indices = [];
        const skinCat = (EmojiIndicesByCategoryAndSkin.get(skin) || new Map()).get(cat) || [];
        indices.push(...(EmojiIndicesByCategoryNoSkin.get(cat) || []));
        indices.push(...skinCat);

        result.set(cat, indices);
    }
    return result;
}

const getSkinnedCategories = memoize(genSkinnedCategories);
export const EmojiIndicesByCategory = new Map([${skinnedCats.join(', ')}]);
`;

// Create the emoji.ts file
const webappUtilsEmojiTSDir = path.resolve(webappRootDir, 'channels', 'src', 'utils', 'emoji.ts');
endResults.push(writeToFileAndPrint('emoji.ts', webappUtilsEmojiTSDir, emojiJSX));

const serverEmojiDataDir = path.resolve(serverRootDir, 'public', 'model', 'emoji_data.go');
const emojiGo = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file is automatically generated via \`/webapp/channels/build/make_emojis.mjs\`. Do not modify it manually.

package model

var SystemEmojis = map[string]string{
${emojiImagesByAlias.join(`,
`)},
}
`;

// Create the emoji_data.go file
const goPromise = writeToFileAndPrint('emoji_data.go', serverEmojiDataDir, emojiGo);
endResults.push(goPromise);

// Create individual emoji styles
const cssCats = categoryNames.filter((cat) => cat !== 'custom').map((cat) => `.emoji-category-${cat} { background-image: url('${sheetFile}'); }`);
const cssEmojis = [];
for (const key of emojiFilePositions.keys()) {
    cssEmojis.push(`.emoji-${key} { background-position: ${emojiFilePositions.get(key)} }`);
}

const cssRules = `
@charset "UTF-8";

.emojisprite-preview {
    width: ${EMOJI_SIZE_PADDED}px;
    max-width: none;
    height: ${EMOJI_SIZE_PADDED}px;
    background-repeat: no-repeat;
    cursor: pointer;
    -moz-transform: scale(0.5);
    transform-origin: 0 0;
    // Using zoom for now as it results in less blurry emojis on Chrome - MM-34178
    zoom: 0.5;
}

.emojisprite {
    width: ${EMOJI_SIZE_PADDED}px;
    max-width: none;
    height: ${EMOJI_SIZE_PADDED}px;
    background-repeat: no-repeat;
    border-radius: 18px;
    cursor: pointer;
    -moz-transform: scale(0.35);
    zoom: 0.35;
}

.emojisprite-loading {
    width: ${EMOJI_SIZE_PADDED}px;
    max-width: none;
    height: ${EMOJI_SIZE_PADDED}px;
    background-image: none !important;
    background-repeat: no-repeat;
    border-radius: 18px;
    cursor: pointer;
    -moz-transform: scale(0.35);
    zoom: 0.35;
}

${cssCats.join('\n')}
${cssEmojis.join('\n')}
`;

// Create the emojisprite.scss file
const emojispriteDir = path.resolve(webappRootDir, 'channels', 'src', 'sass', 'components', '_emojisprite.scss');
endResults.push(writeToFileAndPrint('_emojisprite.scss', emojispriteDir, cssRules));

log('', '\n');
log('info', 'Running "make-emojis" script...');
Promise.all(endResults).then(() => {
    log('warn', 'Remember to npm run "i18n-extract" as categories might have changed.');
    log('warn', 'Remember to run "gofmt -w ./server/public/model/emoji_data.go" from the root of the repository.');
    log('success', 'make-emojis script completed successfully.');
}).catch((err) => {
    control.abort(); // cancel any other file writing
    log('error', `There was an error while running make-emojis script: ${err}`);
});
