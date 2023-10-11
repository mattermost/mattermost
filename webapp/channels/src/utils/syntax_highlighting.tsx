// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import hlJS from 'highlight.js/lib/core';

import * as TextFormatting from 'utils/text_formatting';

import Constants from './constants';

type LanguageObject = {
    [key: string]: {
        name: string;
        extensions: string[];
        aliases?: string[];
    };
}

const HighlightedLanguages: LanguageObject = Constants.HighlightedLanguages;

export async function highlight(lang: string, code: string) {
    const language = getLanguageFromNameOrAlias(lang);

    if (language) {
        try {
            await registerLanguage(language);
            return hlJS.highlight(code, {language}).value;
        } catch (e) {
            // fall through if highlighting fails and handle below
        }
    }

    return TextFormatting.sanitizeHtml(code);
}

export function renderLineNumbers(code: string) {
    const numberOfLines = code.split(/\r\n|\n|\r/g).length;
    const lineNumbers = [];
    for (let i = 0; i < numberOfLines; i++) {
        lineNumbers.push((i + 1).toString());
    }

    return lineNumbers.join('\n');
}

export function getLanguageFromFileExtension(extension: string): string | null {
    for (const key in HighlightedLanguages) {
        if (HighlightedLanguages[key].extensions.find((x: string) => x === extension)) {
            return key;
        }
    }

    return null;
}

export function canHighlight(language: string): boolean {
    return Boolean(getLanguageFromNameOrAlias(language));
}

export function getLanguageName(language: string): string {
    if (canHighlight(language)) {
        const name: string | undefined = getLanguageFromNameOrAlias(language);
        if (!name) {
            return '';
        }
        return HighlightedLanguages[name].name;
    }

    return '';
}

function getLanguageFromNameOrAlias(name: string) {
    const langName: string = name.toLowerCase();
    if (HighlightedLanguages[langName]) {
        return langName;
    }

    return Object.keys(HighlightedLanguages).find((key) => {
        const aliases = HighlightedLanguages[key].aliases;
        return aliases && aliases.find((a) => a === langName);
    });
}

async function registerLanguage(languageName: string) {
    const languageImports: {
        [key: string]: any;
    } = {
        '1c': () => import('highlight.js/lib/languages/1c'),
        actionscript: () => import('highlight.js/lib/languages/actionscript'),
        applescript: () => import('highlight.js/lib/languages/applescript'),
        bash: () => import('highlight.js/lib/languages/bash'),
        clojure: () => import('highlight.js/lib/languages/clojure'),
        coffeescript: () => import('highlight.js/lib/languages/coffeescript'),
        cpp: () => import('highlight.js/lib/languages/cpp'),
        csharp: () => import('highlight.js/lib/languages/csharp'),
        css: () => import('highlight.js/lib/languages/css'),
        d: () => import('highlight.js/lib/languages/d'),
        dart: () => import('highlight.js/lib/languages/dart'),
        delphi: () => import('highlight.js/lib/languages/delphi'),
        diff: () => import('highlight.js/lib/languages/diff'),
        django: () => import('highlight.js/lib/languages/django'),
        dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
        elixir: () => import('highlight.js/lib/languages/elixir'),
        erlang: () => import('highlight.js/lib/languages/erlang'),
        fortran: () => import('highlight.js/lib/languages/fortran'),
        fsharp: () => import('highlight.js/lib/languages/fsharp'),
        gcode: () => import('highlight.js/lib/languages/gcode'),
        go: () => import('highlight.js/lib/languages/go'),
        groovy: () => import('highlight.js/lib/languages/groovy'),
        handlebars: () => import('highlight.js/lib/languages/handlebars'),
        haskell: () => import('highlight.js/lib/languages/haskell'),
        haxe: () => import('highlight.js/lib/languages/haxe'),
        java: () => import('highlight.js/lib/languages/java'),
        javascript: () => import('highlight.js/lib/languages/javascript'),
        json: () => import('highlight.js/lib/languages/json'),
        julia: () => import('highlight.js/lib/languages/julia'),
        kotlin: () => import('highlight.js/lib/languages/kotlin'),
        latex: () => import('highlight.js/lib/languages/latex'),
        less: () => import('highlight.js/lib/languages/less'),
        lisp: () => import('highlight.js/lib/languages/lisp'),
        lua: () => import('highlight.js/lib/languages/lua'),
        makefile: () => import('highlight.js/lib/languages/makefile'),
        markdown: () => import('highlight.js/lib/languages/markdown'),
        matlab: () => import('highlight.js/lib/languages/matlab'),
        objectivec: () => import('highlight.js/lib/languages/objectivec'),
        ocaml: () => import('highlight.js/lib/languages/ocaml'),
        perl: () => import('highlight.js/lib/languages/perl'),
        pgsql: () => import('highlight.js/lib/languages/pgsql'),
        php: () => import('highlight.js/lib/languages/php'),
        plaintext: () => import('highlight.js/lib/languages/plaintext'),
        powershell: () => import('highlight.js/lib/languages/powershell'),
        puppet: () => import('highlight.js/lib/languages/puppet'),
        python: () => import('highlight.js/lib/languages/python'),
        r: () => import('highlight.js/lib/languages/r'),
        ruby: () => import('highlight.js/lib/languages/ruby'),
        rust: () => import('highlight.js/lib/languages/rust'),
        scala: () => import('highlight.js/lib/languages/scala'),
        scheme: () => import('highlight.js/lib/languages/scheme'),
        scss: () => import('highlight.js/lib/languages/scss'),
        smalltalk: () => import('highlight.js/lib/languages/smalltalk'),
        sql: () => import('highlight.js/lib/languages/sql'),
        stylus: () => import('highlight.js/lib/languages/stylus'),
        swift: () => import('highlight.js/lib/languages/swift'),
        typescript: () => import('highlight.js/lib/languages/typescript'),
        vbnet: () => import('highlight.js/lib/languages/vbnet'),
        vbscript: () => import('highlight.js/lib/languages/vbscript'),
        verilog: () => import('highlight.js/lib/languages/verilog'),
        vhdl: () => import('highlight.js/lib/languages/vhdl'),
        xml: () => import('highlight.js/lib/languages/xml'),
        yaml: () => import('highlight.js/lib/languages/yaml'),
    };

    if (!languageImports[languageName]) {
        return;
    }

    const language = (await languageImports[languageName]()).default;

    hlJS.registerLanguage(languageName, language);
}
