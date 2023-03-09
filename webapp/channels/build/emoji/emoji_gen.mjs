// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/*
* This function will generate the emoji files for both the webapp and server to use emojis from emoji-datasource
* It will generate the following files:
* 'mattermost-webapp/utils/emoji.ts'
* 'mattermost-webapp/sass/components/_emojisprite.scss'
* 'mattermost-webapp/utils/emoji.json'
* 'mattermost-server/model/emoji_data.go', (if server-dir argument is passed with path to server, otherwise it will be generated in './emoji_data.go'")
*
* For help on how to use this script, run:
* npm run make-emojis -- --help
*/

import path from 'path';
import * as Fs from 'fs/promises';
import {readFileSync} from 'fs';

import yargs from 'yargs';
import jsonData from 'emoji-datasource/emoji.json';
import jsonCategories from 'emoji-datasource/categories.json';

import additionalShortnames from './additional_shortnames.json';

const EMOJI_SIZE = 64;
const EMOJI_SIZE_PADDED = EMOJI_SIZE + 2; // 1px per side
const EMOJI_DEFAULT_SKIN = 'default';
const endResults = [];

const argv = yargs(process.argv.slice(2)).
    scriptName('make-emojis').
    usage('Usage : npm run $0 -- [args]').
    example('npm run $0 -- --excluded-emoji-file ./excludedEmojis.txt', 'removes mentioned emojis from the app').
    example('npm run $0 -- --server-dir ../mattermost-server', 'path to mattermost-server for copying emoji_data.go file').
    option('server-dir', {
        description: 'Path to mattermost-server',
        type: 'string',
    }).
    option('excluded-emoji-file', {
        description: 'Path to a file containing emoji short names to exclude',
        type: 'string',
    }).
    help().
    epilog('Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.').
    argv;

const argsExcludedEmojiFile = argv['excluded-emoji-file'];
const argsServerDirectory = argv['server-dir'];

const successLogColor = '\x1b[32m%s\x1b[0m';
const errorLogColor = '\x1b[31m%s\x1b[0m';
const warnLogColor = '\x1b[33m%s\x1b[0m';

// copy image files
const source = `node_modules/emoji-datasource-apple/img/apple/${EMOJI_SIZE}/`;
const readDirPromise = Fs.readdir(source);
endResults.push(readDirPromise);
readDirPromise.then((images) => {
    console.log(`Copying ${images.length} emoji images, this might take a while`);

    for (const imageFile of images) {
        endResults.push(
            Fs.copyFile(path.join(source, imageFile), path.join('images/emoji', imageFile)).
                catch((err) => console.log(errorLogColor, `[ERROR] Failed to copy ${imageFile}: ${err}`)));
    }
});
Fs.copyFile('images/icon64x64.png', 'images/emoji/mattermost.png');

// copy sheet image
const sheetSource = `node_modules/emoji-datasource-apple/img/apple/sheets/${EMOJI_SIZE}.png`;
const sheetFile = 'images/emoji-sheets/apple-sheet.png';
console.log('Copying sprite sheet');
Fs.copyFile(sheetSource, sheetFile).catch((err) => console.log(errorLogColor, `[ERROR] Failed to copy sheet file: ${err}`));

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

function filename(emoji) {
    return emoji.image.split('.')[0];
}

function writeFile(fileName, filePath, data) {
    const promise = Fs.writeFile(filePath, data, writeOptions);

    promise.then(() => {
        console.log(successLogColor, `${fileName} generated successfully.`);
    });
    return promise;
}

function convertCategory(category) {
    return category.toLowerCase().replace(' & ', '-');
}

function addIndexToMap(emojiMap, key, ...indexes) {
    const newList = emojiMap.get(key) || [];
    newList.push(...indexes);
    emojiMap.set(key, newList);
}

function genSkinVariations(emoji) {
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

// Extract excluded emoji shortnames as an array
const excludedEmoji = [];
if (argsExcludedEmojiFile) {
    readFileSync(path.normalize(argsExcludedEmojiFile), 'utf-8').split(/\r?\n/).forEach((line) => {
        excludedEmoji.push(line);
    });
    console.log(warnLogColor, `\n[WARNING] The following emoji(s) will be excluded from the webapp: \n${excludedEmoji}\n`);
}

// Remove unwanted emoji
const filteredEmojiJson = jsonData.filter((element) => !excludedEmoji.some((e) => element.short_names.includes(e)));

// populate skin tones as full emojis
const fullEmoji = [...filteredEmojiJson];
filteredEmojiJson.forEach((emoji) => {
    const variations = genSkinVariations(emoji);
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

const skinset = new Set();
fullEmoji.forEach((emoji, index) => {
    if (emoji.unified) {
        emojiIndicesByUnicode.push([emoji.unified.toLowerCase(), index]);
    }

    const safeCat = convertCategory(emoji.category);
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
    const file = filename(emoji);
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

// Removed properties that are not needed for the webapp
const trimmedDownEmojis = fullEmoji.map((emoji) => trimPropertiesFromEmoji(emoji));

// write emoji.json
endResults.push(writeFile('emoji.json', 'utils/emoji.json', JSON.stringify(trimmedDownEmojis, null, 4)));

const categoryList = Object.keys(jsonCategories).filter((item) => item !== 'Component').map(convertCategory);
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

// generate emoji.ts out of the emoji.json parsing we did
const emojiJSX = `// This file is automatically generated via \`make emojis\`. Do not modify it manually.

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

// write emoji.ts
endResults.push(writeFile('emoji.ts', 'utils/emoji.ts', emojiJSX));

// golang emoji data

const emojiGo = `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// This file is automatically generated via \`make emojis\`. Do not modify it manually.

package model

var SystemEmojis = map[string]string{
${emojiImagesByAlias.join(`,
`)},
}
`;

const goPromise = writeFile('emoji_data.go', 'emoji_data.go', emojiGo);
endResults.push(goPromise);

// If server-dir is defined we can update the file emoji_data.go in the server directory
if (argsServerDirectory) {
    const destination = path.join(argsServerDirectory, 'model/emoji_data.go');
    goPromise.then(() => {
        // this is an obvious race condition, as goPromise might be the last one, and then executed out of the `all` call below,
        // but it shouldn't be any problem other than a log out of place and a need to do an explicit catch.
        const mvPromise = Fs.rename('emoji_data.go', destination);
        endResults.push(mvPromise);
        mvPromise.catch((err) => {
            console.log(errorLogColor, `[ERROR] There was an error trying to move the emoji_data.go file: ${err}`);
        });
    });
} else {
    console.log(warnLogColor, '\n[WARNING] server-dir path not defined, `emoji_data.go` will be located in the root of this project, remember to move it to the server\n');
}

// sprite css file
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

// write emoji.ts
endResults.push(writeFile('_emojisprite.scss', 'sass/components/_emojisprite.scss', cssRules));

Promise.all(endResults).then(() => {
    console.log(warnLogColor, '\n[WARNING] Remember to run `make i18n-extract` as categories might have changed.');
}).catch((err) => {
    control.abort(); // cancel any other file writing
    console.log(errorLogColor, `[ERROR] There was an error writing emojis: ${err}`);
});
