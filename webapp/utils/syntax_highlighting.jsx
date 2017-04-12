// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as TextFormatting from './text_formatting.jsx';
import Constants from './constants.jsx';

import hlJS from 'highlight.js/lib/highlight.js';

import hljsActionscript from 'highlight.js/lib/languages/actionscript.js';
import hljsApplescript from 'highlight.js/lib/languages/applescript.js';
import hljsBash from 'highlight.js/lib/languages/bash.js';
import hljsClojure from 'highlight.js/lib/languages/clojure.js';
import hljsCoffeescript from 'highlight.js/lib/languages/coffeescript.js';
import hljsCpp from 'highlight.js/lib/languages/cpp.js';
import hljsCs from 'highlight.js/lib/languages/cs.js';
import hljsCss from 'highlight.js/lib/languages/css.js';
import hljsD from 'highlight.js/lib/languages/d.js';
import hljsDart from 'highlight.js/lib/languages/dart.js';
import hljsDelphi from 'highlight.js/lib/languages/delphi.js';
import hljsDiff from 'highlight.js/lib/languages/diff.js';
import hljsDjango from 'highlight.js/lib/languages/django.js';
import hljsDockerfile from 'highlight.js/lib/languages/dockerfile.js';
import hljsErlang from 'highlight.js/lib/languages/erlang.js';
import hljsFortran from 'highlight.js/lib/languages/fortran.js';
import hljsFsharp from 'highlight.js/lib/languages/fsharp.js';
import hljsGcode from 'highlight.js/lib/languages/gcode.js';
import hljsGo from 'highlight.js/lib/languages/go.js';
import hljsGroovy from 'highlight.js/lib/languages/groovy.js';
import hljsHandlebars from 'highlight.js/lib/languages/handlebars.js';
import hljsHaskell from 'highlight.js/lib/languages/haskell.js';
import hljsHaxe from 'highlight.js/lib/languages/haxe.js';
import hljsJava from 'highlight.js/lib/languages/java.js';
import hljsJavascript from 'highlight.js/lib/languages/javascript.js';
import hljsJson from 'highlight.js/lib/languages/json.js';
import hljsJulia from 'highlight.js/lib/languages/julia.js';
import hljsKotlin from 'highlight.js/lib/languages/kotlin.js';
import hljsLess from 'highlight.js/lib/languages/less.js';
import hljsLisp from 'highlight.js/lib/languages/lisp.js';
import hljsLua from 'highlight.js/lib/languages/lua.js';
import hljsMakefile from 'highlight.js/lib/languages/makefile.js';
import hljsMarkdown from 'highlight.js/lib/languages/markdown.js';
import hljsMatlab from 'highlight.js/lib/languages/matlab.js';
import hljsObjectivec from 'highlight.js/lib/languages/objectivec.js';
import hljsOcaml from 'highlight.js/lib/languages/ocaml.js';
import hljsPerl from 'highlight.js/lib/languages/perl.js';
import hljsPhp from 'highlight.js/lib/languages/php.js';
import hljsPowershell from 'highlight.js/lib/languages/powershell.js';
import hljsPuppet from 'highlight.js/lib/languages/puppet.js';
import hljsPython from 'highlight.js/lib/languages/python.js';
import hljsR from 'highlight.js/lib/languages/r.js';
import hljsRuby from 'highlight.js/lib/languages/ruby.js';
import hljsRust from 'highlight.js/lib/languages/rust.js';
import hljsScala from 'highlight.js/lib/languages/scala.js';
import hljsScheme from 'highlight.js/lib/languages/scheme.js';
import hljsScss from 'highlight.js/lib/languages/scss.js';
import hljsSmalltalk from 'highlight.js/lib/languages/smalltalk.js';
import hljsSql from 'highlight.js/lib/languages/sql.js';
import hljsSwift from 'highlight.js/lib/languages/swift.js';
import hljsTex from 'highlight.js/lib/languages/tex.js';
import hljsVbnet from 'highlight.js/lib/languages/vbnet.js';
import hljsVbscript from 'highlight.js/lib/languages/vbscript.js';
import hljsVerilog from 'highlight.js/lib/languages/verilog.js';
import hljsXml from 'highlight.js/lib/languages/xml.js';
import hljsYaml from 'highlight.js/lib/languages/yaml.js';

hlJS.registerLanguage('actionscript', hljsActionscript);
hlJS.registerLanguage('applescript', hljsApplescript);
hlJS.registerLanguage('bash', hljsBash);
hlJS.registerLanguage('clojure', hljsClojure);
hlJS.registerLanguage('coffeescript', hljsCoffeescript);
hlJS.registerLanguage('cpp', hljsCpp);
hlJS.registerLanguage('cs', hljsCs);
hlJS.registerLanguage('css', hljsCss);
hlJS.registerLanguage('d', hljsD);
hlJS.registerLanguage('dart', hljsDart);
hlJS.registerLanguage('delphi', hljsDelphi);
hlJS.registerLanguage('diff', hljsDiff);
hlJS.registerLanguage('django', hljsDjango);
hlJS.registerLanguage('dockerfile', hljsDockerfile);
hlJS.registerLanguage('erlang', hljsErlang);
hlJS.registerLanguage('fortran', hljsFortran);
hlJS.registerLanguage('fsharp', hljsFsharp);
hlJS.registerLanguage('gcode', hljsGcode);
hlJS.registerLanguage('go', hljsGo);
hlJS.registerLanguage('groovy', hljsGroovy);
hlJS.registerLanguage('handlebars', hljsHandlebars);
hlJS.registerLanguage('haskell', hljsHaskell);
hlJS.registerLanguage('haxe', hljsHaxe);
hlJS.registerLanguage('java', hljsJava);
hlJS.registerLanguage('javascript', hljsJavascript);
hlJS.registerLanguage('json', hljsJson);
hlJS.registerLanguage('julia', hljsJulia);
hlJS.registerLanguage('kotlin', hljsKotlin);
hlJS.registerLanguage('less', hljsLess);
hlJS.registerLanguage('lisp', hljsLisp);
hlJS.registerLanguage('lua', hljsLua);
hlJS.registerLanguage('makefile', hljsMakefile);
hlJS.registerLanguage('markdown', hljsMarkdown);
hlJS.registerLanguage('matlab', hljsMatlab);
hlJS.registerLanguage('objectivec', hljsObjectivec);
hlJS.registerLanguage('ocaml', hljsOcaml);
hlJS.registerLanguage('perl', hljsPerl);
hlJS.registerLanguage('php', hljsPhp);
hlJS.registerLanguage('powershell', hljsPowershell);
hlJS.registerLanguage('puppet', hljsPuppet);
hlJS.registerLanguage('python', hljsPython);
hlJS.registerLanguage('r', hljsR);
hlJS.registerLanguage('ruby', hljsRuby);
hlJS.registerLanguage('rust', hljsRust);
hlJS.registerLanguage('scala', hljsScala);
hlJS.registerLanguage('scheme', hljsScheme);
hlJS.registerLanguage('scss', hljsScss);
hlJS.registerLanguage('smalltalk', hljsSmalltalk);
hlJS.registerLanguage('sql', hljsSql);
hlJS.registerLanguage('swift', hljsSwift);
hlJS.registerLanguage('tex', hljsTex);
hlJS.registerLanguage('vbnet', hljsVbnet);
hlJS.registerLanguage('vbscript', hljsVbscript);
hlJS.registerLanguage('verilog', hljsVerilog);
hlJS.registerLanguage('xml', hljsXml);
hlJS.registerLanguage('yaml', hljsYaml);

const HighlightedLanguages = Constants.HighlightedLanguages;

export function highlight(lang, code) {
    const language = getLanguageFromNameOrAlias(lang);

    if (language) {
        try {
            return hlJS.highlight(language, code).value;
        } catch (e) {
            // fall through if highlighting fails and handle below
        }
    }

    return TextFormatting.sanitizeHtml(code);
}

export function getLanguageFromFileExtension(extension) {
    for (var key in HighlightedLanguages) {
        if (HighlightedLanguages[key].extensions.find((x) => x === extension)) {
            return key;
        }
    }

    return null;
}

export function canHighlight(language) {
    return Boolean(getLanguageFromNameOrAlias(language));
}

export function getLanguageName(language) {
    if (canHighlight(language)) {
        return HighlightedLanguages[getLanguageFromNameOrAlias(language)].name;
    }

    return '';
}

function getLanguageFromNameOrAlias(name) {
    const langName = name.toLowerCase();
    if (HighlightedLanguages[langName]) {
        return langName;
    }

    return Object.keys(HighlightedLanguages).find((key) => {
        const aliases = HighlightedLanguages[key].aliases;
        return aliases && aliases.find((a) => a === langName);
    });
}
