/**
 * This file holds a list of all no-argument functions and single-character
 * symbols (like 'a' or ';').
 *
 * For each of the symbols, there are three properties they can have:
 * - font (required): the font to be used for this symbol. Either "main" (the
     normal font), or "ams" (the ams fonts).
 * - group (required): the ParseNode group type the symbol should have (i.e.
     "textord", "mathord", etc).
     See https://github.com/Khan/KaTeX/wiki/Examining-TeX#group-types
 * - replace: the character that this symbol or function should be
 *   replaced with (i.e. "\phi" has a replace value of "\u03d5", the phi
 *   character in the main font).
 *
 * The outermost map in the table indicates what mode the symbols should be
 * accepted in (e.g. "math" or "text").
 */

module.exports = {
    math: {},
    text: {},
};

function defineSymbol(mode, font, group, replace, name) {
    module.exports[mode][name] = {
        font: font,
        group: group,
        replace: replace,
    };
}

// Some abbreviations for commonly used strings.
// This helps minify the code, and also spotting typos using jshint.

// modes:
var math = "math";
var text = "text";

// fonts:
var main = "main";
var ams = "ams";

// groups:
var accent = "accent";
var bin = "bin";
var close = "close";
var inner = "inner";
var mathord = "mathord";
var op = "op";
var open = "open";
var punct = "punct";
var rel = "rel";
var spacing = "spacing";
var textord = "textord";

// Now comes the symbol table

// Relation Symbols
defineSymbol(math, main, rel, "\u2261", "\\equiv");
defineSymbol(math, main, rel, "\u227a", "\\prec");
defineSymbol(math, main, rel, "\u227b", "\\succ");
defineSymbol(math, main, rel, "\u223c", "\\sim");
defineSymbol(math, main, rel, "\u22a5", "\\perp");
defineSymbol(math, main, rel, "\u2aaf", "\\preceq");
defineSymbol(math, main, rel, "\u2ab0", "\\succeq");
defineSymbol(math, main, rel, "\u2243", "\\simeq");
defineSymbol(math, main, rel, "\u2223", "\\mid");
defineSymbol(math, main, rel, "\u226a", "\\ll");
defineSymbol(math, main, rel, "\u226b", "\\gg");
defineSymbol(math, main, rel, "\u224d", "\\asymp");
defineSymbol(math, main, rel, "\u2225", "\\parallel");
defineSymbol(math, main, rel, "\u22c8", "\\bowtie");
defineSymbol(math, main, rel, "\u2323", "\\smile");
defineSymbol(math, main, rel, "\u2291", "\\sqsubseteq");
defineSymbol(math, main, rel, "\u2292", "\\sqsupseteq");
defineSymbol(math, main, rel, "\u2250", "\\doteq");
defineSymbol(math, main, rel, "\u2322", "\\frown");
defineSymbol(math, main, rel, "\u220b", "\\ni");
defineSymbol(math, main, rel, "\u221d", "\\propto");
defineSymbol(math, main, rel, "\u22a2", "\\vdash");
defineSymbol(math, main, rel, "\u22a3", "\\dashv");
defineSymbol(math, main, rel, "\u220b", "\\owns");

// Punctuation
defineSymbol(math, main, punct, "\u002e", "\\ldotp");
defineSymbol(math, main, punct, "\u22c5", "\\cdotp");

// Misc Symbols
defineSymbol(math, main, textord, "\u0023", "\\#");
defineSymbol(math, main, textord, "\u0026", "\\&");
defineSymbol(math, main, textord, "\u2135", "\\aleph");
defineSymbol(math, main, textord, "\u2200", "\\forall");
defineSymbol(math, main, textord, "\u210f", "\\hbar");
defineSymbol(math, main, textord, "\u2203", "\\exists");
defineSymbol(math, main, textord, "\u2207", "\\nabla");
defineSymbol(math, main, textord, "\u266d", "\\flat");
defineSymbol(math, main, textord, "\u2113", "\\ell");
defineSymbol(math, main, textord, "\u266e", "\\natural");
defineSymbol(math, main, textord, "\u2663", "\\clubsuit");
defineSymbol(math, main, textord, "\u2118", "\\wp");
defineSymbol(math, main, textord, "\u266f", "\\sharp");
defineSymbol(math, main, textord, "\u2662", "\\diamondsuit");
defineSymbol(math, main, textord, "\u211c", "\\Re");
defineSymbol(math, main, textord, "\u2661", "\\heartsuit");
defineSymbol(math, main, textord, "\u2111", "\\Im");
defineSymbol(math, main, textord, "\u2660", "\\spadesuit");

// Math and Text
defineSymbol(math, main, textord, "\u2020", "\\dag");
defineSymbol(math, main, textord, "\u2021", "\\ddag");

// Large Delimiters
defineSymbol(math, main, close, "\u23b1", "\\rmoustache");
defineSymbol(math, main, open, "\u23b0", "\\lmoustache");
defineSymbol(math, main, close, "\u27ef", "\\rgroup");
defineSymbol(math, main, open, "\u27ee", "\\lgroup");

// Binary Operators
defineSymbol(math, main, bin, "\u2213", "\\mp");
defineSymbol(math, main, bin, "\u2296", "\\ominus");
defineSymbol(math, main, bin, "\u228e", "\\uplus");
defineSymbol(math, main, bin, "\u2293", "\\sqcap");
defineSymbol(math, main, bin, "\u2217", "\\ast");
defineSymbol(math, main, bin, "\u2294", "\\sqcup");
defineSymbol(math, main, bin, "\u25ef", "\\bigcirc");
defineSymbol(math, main, bin, "\u2219", "\\bullet");
defineSymbol(math, main, bin, "\u2021", "\\ddagger");
defineSymbol(math, main, bin, "\u2240", "\\wr");
defineSymbol(math, main, bin, "\u2a3f", "\\amalg");

// Arrow Symbols
defineSymbol(math, main, rel, "\u27f5", "\\longleftarrow");
defineSymbol(math, main, rel, "\u21d0", "\\Leftarrow");
defineSymbol(math, main, rel, "\u27f8", "\\Longleftarrow");
defineSymbol(math, main, rel, "\u27f6", "\\longrightarrow");
defineSymbol(math, main, rel, "\u21d2", "\\Rightarrow");
defineSymbol(math, main, rel, "\u27f9", "\\Longrightarrow");
defineSymbol(math, main, rel, "\u2194", "\\leftrightarrow");
defineSymbol(math, main, rel, "\u27f7", "\\longleftrightarrow");
defineSymbol(math, main, rel, "\u21d4", "\\Leftrightarrow");
defineSymbol(math, main, rel, "\u27fa", "\\Longleftrightarrow");
defineSymbol(math, main, rel, "\u21a6", "\\mapsto");
defineSymbol(math, main, rel, "\u27fc", "\\longmapsto");
defineSymbol(math, main, rel, "\u2197", "\\nearrow");
defineSymbol(math, main, rel, "\u21a9", "\\hookleftarrow");
defineSymbol(math, main, rel, "\u21aa", "\\hookrightarrow");
defineSymbol(math, main, rel, "\u2198", "\\searrow");
defineSymbol(math, main, rel, "\u21bc", "\\leftharpoonup");
defineSymbol(math, main, rel, "\u21c0", "\\rightharpoonup");
defineSymbol(math, main, rel, "\u2199", "\\swarrow");
defineSymbol(math, main, rel, "\u21bd", "\\leftharpoondown");
defineSymbol(math, main, rel, "\u21c1", "\\rightharpoondown");
defineSymbol(math, main, rel, "\u2196", "\\nwarrow");
defineSymbol(math, main, rel, "\u21cc", "\\rightleftharpoons");

// AMS Negated Binary Relations
defineSymbol(math, ams, rel, "\u226e", "\\nless");
defineSymbol(math, ams, rel, "\ue010", "\\nleqslant");
defineSymbol(math, ams, rel, "\ue011", "\\nleqq");
defineSymbol(math, ams, rel, "\u2a87", "\\lneq");
defineSymbol(math, ams, rel, "\u2268", "\\lneqq");
defineSymbol(math, ams, rel, "\ue00c", "\\lvertneqq");
defineSymbol(math, ams, rel, "\u22e6", "\\lnsim");
defineSymbol(math, ams, rel, "\u2a89", "\\lnapprox");
defineSymbol(math, ams, rel, "\u2280", "\\nprec");
defineSymbol(math, ams, rel, "\u22e0", "\\npreceq");
defineSymbol(math, ams, rel, "\u22e8", "\\precnsim");
defineSymbol(math, ams, rel, "\u2ab9", "\\precnapprox");
defineSymbol(math, ams, rel, "\u2241", "\\nsim");
defineSymbol(math, ams, rel, "\ue006", "\\nshortmid");
defineSymbol(math, ams, rel, "\u2224", "\\nmid");
defineSymbol(math, ams, rel, "\u22ac", "\\nvdash");
defineSymbol(math, ams, rel, "\u22ad", "\\nvDash");
defineSymbol(math, ams, rel, "\u22ea", "\\ntriangleleft");
defineSymbol(math, ams, rel, "\u22ec", "\\ntrianglelefteq");
defineSymbol(math, ams, rel, "\u228a", "\\subsetneq");
defineSymbol(math, ams, rel, "\ue01a", "\\varsubsetneq");
defineSymbol(math, ams, rel, "\u2acb", "\\subsetneqq");
defineSymbol(math, ams, rel, "\ue017", "\\varsubsetneqq");
defineSymbol(math, ams, rel, "\u226f", "\\ngtr");
defineSymbol(math, ams, rel, "\ue00f", "\\ngeqslant");
defineSymbol(math, ams, rel, "\ue00e", "\\ngeqq");
defineSymbol(math, ams, rel, "\u2a88", "\\gneq");
defineSymbol(math, ams, rel, "\u2269", "\\gneqq");
defineSymbol(math, ams, rel, "\ue00d", "\\gvertneqq");
defineSymbol(math, ams, rel, "\u22e7", "\\gnsim");
defineSymbol(math, ams, rel, "\u2a8a", "\\gnapprox");
defineSymbol(math, ams, rel, "\u2281", "\\nsucc");
defineSymbol(math, ams, rel, "\u22e1", "\\nsucceq");
defineSymbol(math, ams, rel, "\u22e9", "\\succnsim");
defineSymbol(math, ams, rel, "\u2aba", "\\succnapprox");
defineSymbol(math, ams, rel, "\u2246", "\\ncong");
defineSymbol(math, ams, rel, "\ue007", "\\nshortparallel");
defineSymbol(math, ams, rel, "\u2226", "\\nparallel");
defineSymbol(math, ams, rel, "\u22af", "\\nVDash");
defineSymbol(math, ams, rel, "\u22eb", "\\ntriangleright");
defineSymbol(math, ams, rel, "\u22ed", "\\ntrianglerighteq");
defineSymbol(math, ams, rel, "\ue018", "\\nsupseteqq");
defineSymbol(math, ams, rel, "\u228b", "\\supsetneq");
defineSymbol(math, ams, rel, "\ue01b", "\\varsupsetneq");
defineSymbol(math, ams, rel, "\u2acc", "\\supsetneqq");
defineSymbol(math, ams, rel, "\ue019", "\\varsupsetneqq");
defineSymbol(math, ams, rel, "\u22ae", "\\nVdash");
defineSymbol(math, ams, rel, "\u2ab5", "\\precneqq");
defineSymbol(math, ams, rel, "\u2ab6", "\\succneqq");
defineSymbol(math, ams, rel, "\ue016", "\\nsubseteqq");
defineSymbol(math, ams, bin, "\u22b4", "\\unlhd");
defineSymbol(math, ams, bin, "\u22b5", "\\unrhd");

// AMS Negated Arrows
defineSymbol(math, ams, rel, "\u219a", "\\nleftarrow");
defineSymbol(math, ams, rel, "\u219b", "\\nrightarrow");
defineSymbol(math, ams, rel, "\u21cd", "\\nLeftarrow");
defineSymbol(math, ams, rel, "\u21cf", "\\nRightarrow");
defineSymbol(math, ams, rel, "\u21ae", "\\nleftrightarrow");
defineSymbol(math, ams, rel, "\u21ce", "\\nLeftrightarrow");

// AMS Misc
defineSymbol(math, ams, rel, "\u25b3", "\\vartriangle");
defineSymbol(math, ams, textord, "\u210f", "\\hslash");
defineSymbol(math, ams, textord, "\u25bd", "\\triangledown");
defineSymbol(math, ams, textord, "\u25ca", "\\lozenge");
defineSymbol(math, ams, textord, "\u24c8", "\\circledS");
defineSymbol(math, ams, textord, "\u00ae", "\\circledR");
defineSymbol(math, ams, textord, "\u2221", "\\measuredangle");
defineSymbol(math, ams, textord, "\u2204", "\\nexists");
defineSymbol(math, ams, textord, "\u2127", "\\mho");
defineSymbol(math, ams, textord, "\u2132", "\\Finv");
defineSymbol(math, ams, textord, "\u2141", "\\Game");
defineSymbol(math, ams, textord, "\u006b", "\\Bbbk");
defineSymbol(math, ams, textord, "\u2035", "\\backprime");
defineSymbol(math, ams, textord, "\u25b2", "\\blacktriangle");
defineSymbol(math, ams, textord, "\u25bc", "\\blacktriangledown");
defineSymbol(math, ams, textord, "\u25a0", "\\blacksquare");
defineSymbol(math, ams, textord, "\u29eb", "\\blacklozenge");
defineSymbol(math, ams, textord, "\u2605", "\\bigstar");
defineSymbol(math, ams, textord, "\u2222", "\\sphericalangle");
defineSymbol(math, ams, textord, "\u2201", "\\complement");
defineSymbol(math, ams, textord, "\u00f0", "\\eth");
defineSymbol(math, ams, textord, "\u2571", "\\diagup");
defineSymbol(math, ams, textord, "\u2572", "\\diagdown");
defineSymbol(math, ams, textord, "\u25a1", "\\square");
defineSymbol(math, ams, textord, "\u25a1", "\\Box");
defineSymbol(math, ams, textord, "\u25ca", "\\Diamond");
defineSymbol(math, ams, textord, "\u00a5", "\\yen");
defineSymbol(math, ams, textord, "\u2713", "\\checkmark");

// AMS Hebrew
defineSymbol(math, ams, textord, "\u2136", "\\beth");
defineSymbol(math, ams, textord, "\u2138", "\\daleth");
defineSymbol(math, ams, textord, "\u2137", "\\gimel");

// AMS Greek
defineSymbol(math, ams, textord, "\u03dd", "\\digamma");
defineSymbol(math, ams, textord, "\u03f0", "\\varkappa");

// AMS Delimiters
defineSymbol(math, ams, open, "\u250c", "\\ulcorner");
defineSymbol(math, ams, close, "\u2510", "\\urcorner");
defineSymbol(math, ams, open, "\u2514", "\\llcorner");
defineSymbol(math, ams, close, "\u2518", "\\lrcorner");

// AMS Binary Relations
defineSymbol(math, ams, rel, "\u2266", "\\leqq");
defineSymbol(math, ams, rel, "\u2a7d", "\\leqslant");
defineSymbol(math, ams, rel, "\u2a95", "\\eqslantless");
defineSymbol(math, ams, rel, "\u2272", "\\lesssim");
defineSymbol(math, ams, rel, "\u2a85", "\\lessapprox");
defineSymbol(math, ams, rel, "\u224a", "\\approxeq");
defineSymbol(math, ams, bin, "\u22d6", "\\lessdot");
defineSymbol(math, ams, rel, "\u22d8", "\\lll");
defineSymbol(math, ams, rel, "\u2276", "\\lessgtr");
defineSymbol(math, ams, rel, "\u22da", "\\lesseqgtr");
defineSymbol(math, ams, rel, "\u2a8b", "\\lesseqqgtr");
defineSymbol(math, ams, rel, "\u2251", "\\doteqdot");
defineSymbol(math, ams, rel, "\u2253", "\\risingdotseq");
defineSymbol(math, ams, rel, "\u2252", "\\fallingdotseq");
defineSymbol(math, ams, rel, "\u223d", "\\backsim");
defineSymbol(math, ams, rel, "\u22cd", "\\backsimeq");
defineSymbol(math, ams, rel, "\u2ac5", "\\subseteqq");
defineSymbol(math, ams, rel, "\u22d0", "\\Subset");
defineSymbol(math, ams, rel, "\u228f", "\\sqsubset");
defineSymbol(math, ams, rel, "\u227c", "\\preccurlyeq");
defineSymbol(math, ams, rel, "\u22de", "\\curlyeqprec");
defineSymbol(math, ams, rel, "\u227e", "\\precsim");
defineSymbol(math, ams, rel, "\u2ab7", "\\precapprox");
defineSymbol(math, ams, rel, "\u22b2", "\\vartriangleleft");
defineSymbol(math, ams, rel, "\u22b4", "\\trianglelefteq");
defineSymbol(math, ams, rel, "\u22a8", "\\vDash");
defineSymbol(math, ams, rel, "\u22aa", "\\Vvdash");
defineSymbol(math, ams, rel, "\u2323", "\\smallsmile");
defineSymbol(math, ams, rel, "\u2322", "\\smallfrown");
defineSymbol(math, ams, rel, "\u224f", "\\bumpeq");
defineSymbol(math, ams, rel, "\u224e", "\\Bumpeq");
defineSymbol(math, ams, rel, "\u2267", "\\geqq");
defineSymbol(math, ams, rel, "\u2a7e", "\\geqslant");
defineSymbol(math, ams, rel, "\u2a96", "\\eqslantgtr");
defineSymbol(math, ams, rel, "\u2273", "\\gtrsim");
defineSymbol(math, ams, rel, "\u2a86", "\\gtrapprox");
defineSymbol(math, ams, bin, "\u22d7", "\\gtrdot");
defineSymbol(math, ams, rel, "\u22d9", "\\ggg");
defineSymbol(math, ams, rel, "\u2277", "\\gtrless");
defineSymbol(math, ams, rel, "\u22db", "\\gtreqless");
defineSymbol(math, ams, rel, "\u2a8c", "\\gtreqqless");
defineSymbol(math, ams, rel, "\u2256", "\\eqcirc");
defineSymbol(math, ams, rel, "\u2257", "\\circeq");
defineSymbol(math, ams, rel, "\u225c", "\\triangleq");
defineSymbol(math, ams, rel, "\u223c", "\\thicksim");
defineSymbol(math, ams, rel, "\u2248", "\\thickapprox");
defineSymbol(math, ams, rel, "\u2ac6", "\\supseteqq");
defineSymbol(math, ams, rel, "\u22d1", "\\Supset");
defineSymbol(math, ams, rel, "\u2290", "\\sqsupset");
defineSymbol(math, ams, rel, "\u227d", "\\succcurlyeq");
defineSymbol(math, ams, rel, "\u22df", "\\curlyeqsucc");
defineSymbol(math, ams, rel, "\u227f", "\\succsim");
defineSymbol(math, ams, rel, "\u2ab8", "\\succapprox");
defineSymbol(math, ams, rel, "\u22b3", "\\vartriangleright");
defineSymbol(math, ams, rel, "\u22b5", "\\trianglerighteq");
defineSymbol(math, ams, rel, "\u22a9", "\\Vdash");
defineSymbol(math, ams, rel, "\u2223", "\\shortmid");
defineSymbol(math, ams, rel, "\u2225", "\\shortparallel");
defineSymbol(math, ams, rel, "\u226c", "\\between");
defineSymbol(math, ams, rel, "\u22d4", "\\pitchfork");
defineSymbol(math, ams, rel, "\u221d", "\\varpropto");
defineSymbol(math, ams, rel, "\u25c0", "\\blacktriangleleft");
defineSymbol(math, ams, rel, "\u2234", "\\therefore");
defineSymbol(math, ams, rel, "\u220d", "\\backepsilon");
defineSymbol(math, ams, rel, "\u25b6", "\\blacktriangleright");
defineSymbol(math, ams, rel, "\u2235", "\\because");
defineSymbol(math, ams, rel, "\u22d8", "\\llless");
defineSymbol(math, ams, rel, "\u22d9", "\\gggtr");
defineSymbol(math, ams, bin, "\u22b2", "\\lhd");
defineSymbol(math, ams, bin, "\u22b3", "\\rhd");
defineSymbol(math, ams, rel, "\u2242", "\\eqsim");
defineSymbol(math, main, rel, "\u22c8", "\\Join");
defineSymbol(math, ams, rel, "\u2251", "\\Doteq");

// AMS Binary Operators
defineSymbol(math, ams, bin, "\u2214", "\\dotplus");
defineSymbol(math, ams, bin, "\u2216", "\\smallsetminus");
defineSymbol(math, ams, bin, "\u22d2", "\\Cap");
defineSymbol(math, ams, bin, "\u22d3", "\\Cup");
defineSymbol(math, ams, bin, "\u2a5e", "\\doublebarwedge");
defineSymbol(math, ams, bin, "\u229f", "\\boxminus");
defineSymbol(math, ams, bin, "\u229e", "\\boxplus");
defineSymbol(math, ams, bin, "\u22c7", "\\divideontimes");
defineSymbol(math, ams, bin, "\u22c9", "\\ltimes");
defineSymbol(math, ams, bin, "\u22ca", "\\rtimes");
defineSymbol(math, ams, bin, "\u22cb", "\\leftthreetimes");
defineSymbol(math, ams, bin, "\u22cc", "\\rightthreetimes");
defineSymbol(math, ams, bin, "\u22cf", "\\curlywedge");
defineSymbol(math, ams, bin, "\u22ce", "\\curlyvee");
defineSymbol(math, ams, bin, "\u229d", "\\circleddash");
defineSymbol(math, ams, bin, "\u229b", "\\circledast");
defineSymbol(math, ams, bin, "\u22c5", "\\centerdot");
defineSymbol(math, ams, bin, "\u22ba", "\\intercal");
defineSymbol(math, ams, bin, "\u22d2", "\\doublecap");
defineSymbol(math, ams, bin, "\u22d3", "\\doublecup");
defineSymbol(math, ams, bin, "\u22a0", "\\boxtimes");

// AMS Arrows
defineSymbol(math, ams, rel, "\u21e2", "\\dashrightarrow");
defineSymbol(math, ams, rel, "\u21e0", "\\dashleftarrow");
defineSymbol(math, ams, rel, "\u21c7", "\\leftleftarrows");
defineSymbol(math, ams, rel, "\u21c6", "\\leftrightarrows");
defineSymbol(math, ams, rel, "\u21da", "\\Lleftarrow");
defineSymbol(math, ams, rel, "\u219e", "\\twoheadleftarrow");
defineSymbol(math, ams, rel, "\u21a2", "\\leftarrowtail");
defineSymbol(math, ams, rel, "\u21ab", "\\looparrowleft");
defineSymbol(math, ams, rel, "\u21cb", "\\leftrightharpoons");
defineSymbol(math, ams, rel, "\u21b6", "\\curvearrowleft");
defineSymbol(math, ams, rel, "\u21ba", "\\circlearrowleft");
defineSymbol(math, ams, rel, "\u21b0", "\\Lsh");
defineSymbol(math, ams, rel, "\u21c8", "\\upuparrows");
defineSymbol(math, ams, rel, "\u21bf", "\\upharpoonleft");
defineSymbol(math, ams, rel, "\u21c3", "\\downharpoonleft");
defineSymbol(math, ams, rel, "\u22b8", "\\multimap");
defineSymbol(math, ams, rel, "\u21ad", "\\leftrightsquigarrow");
defineSymbol(math, ams, rel, "\u21c9", "\\rightrightarrows");
defineSymbol(math, ams, rel, "\u21c4", "\\rightleftarrows");
defineSymbol(math, ams, rel, "\u21a0", "\\twoheadrightarrow");
defineSymbol(math, ams, rel, "\u21a3", "\\rightarrowtail");
defineSymbol(math, ams, rel, "\u21ac", "\\looparrowright");
defineSymbol(math, ams, rel, "\u21b7", "\\curvearrowright");
defineSymbol(math, ams, rel, "\u21bb", "\\circlearrowright");
defineSymbol(math, ams, rel, "\u21b1", "\\Rsh");
defineSymbol(math, ams, rel, "\u21ca", "\\downdownarrows");
defineSymbol(math, ams, rel, "\u21be", "\\upharpoonright");
defineSymbol(math, ams, rel, "\u21c2", "\\downharpoonright");
defineSymbol(math, ams, rel, "\u21dd", "\\rightsquigarrow");
defineSymbol(math, ams, rel, "\u21dd", "\\leadsto");
defineSymbol(math, ams, rel, "\u21db", "\\Rrightarrow");
defineSymbol(math, ams, rel, "\u21be", "\\restriction");

defineSymbol(math, main, textord, "\u2018", "`");
defineSymbol(math, main, textord, "$", "\\$");
defineSymbol(math, main, textord, "%", "\\%");
defineSymbol(math, main, textord, "_", "\\_");
defineSymbol(math, main, textord, "\u2220", "\\angle");
defineSymbol(math, main, textord, "\u221e", "\\infty");
defineSymbol(math, main, textord, "\u2032", "\\prime");
defineSymbol(math, main, textord, "\u25b3", "\\triangle");
defineSymbol(math, main, textord, "\u0393", "\\Gamma");
defineSymbol(math, main, textord, "\u0394", "\\Delta");
defineSymbol(math, main, textord, "\u0398", "\\Theta");
defineSymbol(math, main, textord, "\u039b", "\\Lambda");
defineSymbol(math, main, textord, "\u039e", "\\Xi");
defineSymbol(math, main, textord, "\u03a0", "\\Pi");
defineSymbol(math, main, textord, "\u03a3", "\\Sigma");
defineSymbol(math, main, textord, "\u03a5", "\\Upsilon");
defineSymbol(math, main, textord, "\u03a6", "\\Phi");
defineSymbol(math, main, textord, "\u03a8", "\\Psi");
defineSymbol(math, main, textord, "\u03a9", "\\Omega");
defineSymbol(math, main, textord, "\u00ac", "\\neg");
defineSymbol(math, main, textord, "\u00ac", "\\lnot");
defineSymbol(math, main, textord, "\u22a4", "\\top");
defineSymbol(math, main, textord, "\u22a5", "\\bot");
defineSymbol(math, main, textord, "\u2205", "\\emptyset");
defineSymbol(math, ams, textord, "\u2205", "\\varnothing");
defineSymbol(math, main, mathord, "\u03b1", "\\alpha");
defineSymbol(math, main, mathord, "\u03b2", "\\beta");
defineSymbol(math, main, mathord, "\u03b3", "\\gamma");
defineSymbol(math, main, mathord, "\u03b4", "\\delta");
defineSymbol(math, main, mathord, "\u03f5", "\\epsilon");
defineSymbol(math, main, mathord, "\u03b6", "\\zeta");
defineSymbol(math, main, mathord, "\u03b7", "\\eta");
defineSymbol(math, main, mathord, "\u03b8", "\\theta");
defineSymbol(math, main, mathord, "\u03b9", "\\iota");
defineSymbol(math, main, mathord, "\u03ba", "\\kappa");
defineSymbol(math, main, mathord, "\u03bb", "\\lambda");
defineSymbol(math, main, mathord, "\u03bc", "\\mu");
defineSymbol(math, main, mathord, "\u03bd", "\\nu");
defineSymbol(math, main, mathord, "\u03be", "\\xi");
defineSymbol(math, main, mathord, "o", "\\omicron");
defineSymbol(math, main, mathord, "\u03c0", "\\pi");
defineSymbol(math, main, mathord, "\u03c1", "\\rho");
defineSymbol(math, main, mathord, "\u03c3", "\\sigma");
defineSymbol(math, main, mathord, "\u03c4", "\\tau");
defineSymbol(math, main, mathord, "\u03c5", "\\upsilon");
defineSymbol(math, main, mathord, "\u03d5", "\\phi");
defineSymbol(math, main, mathord, "\u03c7", "\\chi");
defineSymbol(math, main, mathord, "\u03c8", "\\psi");
defineSymbol(math, main, mathord, "\u03c9", "\\omega");
defineSymbol(math, main, mathord, "\u03b5", "\\varepsilon");
defineSymbol(math, main, mathord, "\u03d1", "\\vartheta");
defineSymbol(math, main, mathord, "\u03d6", "\\varpi");
defineSymbol(math, main, mathord, "\u03f1", "\\varrho");
defineSymbol(math, main, mathord, "\u03c2", "\\varsigma");
defineSymbol(math, main, mathord, "\u03c6", "\\varphi");
defineSymbol(math, main, bin, "\u2217", "*");
defineSymbol(math, main, bin, "+", "+");
defineSymbol(math, main, bin, "\u2212", "-");
defineSymbol(math, main, bin, "\u22c5", "\\cdot");
defineSymbol(math, main, bin, "\u2218", "\\circ");
defineSymbol(math, main, bin, "\u00f7", "\\div");
defineSymbol(math, main, bin, "\u00b1", "\\pm");
defineSymbol(math, main, bin, "\u00d7", "\\times");
defineSymbol(math, main, bin, "\u2229", "\\cap");
defineSymbol(math, main, bin, "\u222a", "\\cup");
defineSymbol(math, main, bin, "\u2216", "\\setminus");
defineSymbol(math, main, bin, "\u2227", "\\land");
defineSymbol(math, main, bin, "\u2228", "\\lor");
defineSymbol(math, main, bin, "\u2227", "\\wedge");
defineSymbol(math, main, bin, "\u2228", "\\vee");
defineSymbol(math, main, textord, "\u221a", "\\surd");
defineSymbol(math, main, open, "(", "(");
defineSymbol(math, main, open, "[", "[");
defineSymbol(math, main, open, "\u27e8", "\\langle");
defineSymbol(math, main, open, "\u2223", "\\lvert");
defineSymbol(math, main, open, "\u2225", "\\lVert");
defineSymbol(math, main, close, ")", ")");
defineSymbol(math, main, close, "]", "]");
defineSymbol(math, main, close, "?", "?");
defineSymbol(math, main, close, "!", "!");
defineSymbol(math, main, close, "\u27e9", "\\rangle");
defineSymbol(math, main, close, "\u2223", "\\rvert");
defineSymbol(math, main, close, "\u2225", "\\rVert");
defineSymbol(math, main, rel, "=", "=");
defineSymbol(math, main, rel, "<", "<");
defineSymbol(math, main, rel, ">", ">");
defineSymbol(math, main, rel, ":", ":");
defineSymbol(math, main, rel, "\u2248", "\\approx");
defineSymbol(math, main, rel, "\u2245", "\\cong");
defineSymbol(math, main, rel, "\u2265", "\\ge");
defineSymbol(math, main, rel, "\u2265", "\\geq");
defineSymbol(math, main, rel, "\u2190", "\\gets");
defineSymbol(math, main, rel, ">", "\\gt");
defineSymbol(math, main, rel, "\u2208", "\\in");
defineSymbol(math, main, rel, "\u2209", "\\notin");
defineSymbol(math, main, rel, "\u2282", "\\subset");
defineSymbol(math, main, rel, "\u2283", "\\supset");
defineSymbol(math, main, rel, "\u2286", "\\subseteq");
defineSymbol(math, main, rel, "\u2287", "\\supseteq");
defineSymbol(math, ams, rel, "\u2288", "\\nsubseteq");
defineSymbol(math, ams, rel, "\u2289", "\\nsupseteq");
defineSymbol(math, main, rel, "\u22a8", "\\models");
defineSymbol(math, main, rel, "\u2190", "\\leftarrow");
defineSymbol(math, main, rel, "\u2264", "\\le");
defineSymbol(math, main, rel, "\u2264", "\\leq");
defineSymbol(math, main, rel, "<", "\\lt");
defineSymbol(math, main, rel, "\u2260", "\\ne");
defineSymbol(math, main, rel, "\u2260", "\\neq");
defineSymbol(math, main, rel, "\u2192", "\\rightarrow");
defineSymbol(math, main, rel, "\u2192", "\\to");
defineSymbol(math, ams, rel, "\u2271", "\\ngeq");
defineSymbol(math, ams, rel, "\u2270", "\\nleq");
defineSymbol(math, main, spacing, null, "\\!");
defineSymbol(math, main, spacing, "\u00a0", "\\ ");
defineSymbol(math, main, spacing, "\u00a0", "~");
defineSymbol(math, main, spacing, null, "\\,");
defineSymbol(math, main, spacing, null, "\\:");
defineSymbol(math, main, spacing, null, "\\;");
defineSymbol(math, main, spacing, null, "\\enspace");
defineSymbol(math, main, spacing, null, "\\qquad");
defineSymbol(math, main, spacing, null, "\\quad");
defineSymbol(math, main, spacing, "\u00a0", "\\space");
defineSymbol(math, main, punct, ",", ",");
defineSymbol(math, main, punct, ";", ";");
defineSymbol(math, main, punct, ":", "\\colon");
defineSymbol(math, ams, bin, "\u22bc", "\\barwedge");
defineSymbol(math, ams, bin, "\u22bb", "\\veebar");
defineSymbol(math, main, bin, "\u2299", "\\odot");
defineSymbol(math, main, bin, "\u2295", "\\oplus");
defineSymbol(math, main, bin, "\u2297", "\\otimes");
defineSymbol(math, main, textord, "\u2202", "\\partial");
defineSymbol(math, main, bin, "\u2298", "\\oslash");
defineSymbol(math, ams, bin, "\u229a", "\\circledcirc");
defineSymbol(math, ams, bin, "\u22a1", "\\boxdot");
defineSymbol(math, main, bin, "\u25b3", "\\bigtriangleup");
defineSymbol(math, main, bin, "\u25bd", "\\bigtriangledown");
defineSymbol(math, main, bin, "\u2020", "\\dagger");
defineSymbol(math, main, bin, "\u22c4", "\\diamond");
defineSymbol(math, main, bin, "\u22c6", "\\star");
defineSymbol(math, main, bin, "\u25c3", "\\triangleleft");
defineSymbol(math, main, bin, "\u25b9", "\\triangleright");
defineSymbol(math, main, open, "{", "\\{");
defineSymbol(math, main, close, "}", "\\}");
defineSymbol(math, main, open, "{", "\\lbrace");
defineSymbol(math, main, close, "}", "\\rbrace");
defineSymbol(math, main, open, "[", "\\lbrack");
defineSymbol(math, main, close, "]", "\\rbrack");
defineSymbol(math, main, open, "\u230a", "\\lfloor");
defineSymbol(math, main, close, "\u230b", "\\rfloor");
defineSymbol(math, main, open, "\u2308", "\\lceil");
defineSymbol(math, main, close, "\u2309", "\\rceil");
defineSymbol(math, main, textord, "\\", "\\backslash");
defineSymbol(math, main, textord, "\u2223", "|");
defineSymbol(math, main, textord, "\u2223", "\\vert");
defineSymbol(math, main, textord, "\u2225", "\\|");
defineSymbol(math, main, textord, "\u2225", "\\Vert");
defineSymbol(math, main, rel, "\u2191", "\\uparrow");
defineSymbol(math, main, rel, "\u21d1", "\\Uparrow");
defineSymbol(math, main, rel, "\u2193", "\\downarrow");
defineSymbol(math, main, rel, "\u21d3", "\\Downarrow");
defineSymbol(math, main, rel, "\u2195", "\\updownarrow");
defineSymbol(math, main, rel, "\u21d5", "\\Updownarrow");
defineSymbol(math, math, op, "\u2210", "\\coprod");
defineSymbol(math, math, op, "\u22c1", "\\bigvee");
defineSymbol(math, math, op, "\u22c0", "\\bigwedge");
defineSymbol(math, math, op, "\u2a04", "\\biguplus");
defineSymbol(math, math, op, "\u22c2", "\\bigcap");
defineSymbol(math, math, op, "\u22c3", "\\bigcup");
defineSymbol(math, math, op, "\u222b", "\\int");
defineSymbol(math, math, op, "\u222b", "\\intop");
defineSymbol(math, math, op, "\u222c", "\\iint");
defineSymbol(math, math, op, "\u222d", "\\iiint");
defineSymbol(math, math, op, "\u220f", "\\prod");
defineSymbol(math, math, op, "\u2211", "\\sum");
defineSymbol(math, math, op, "\u2a02", "\\bigotimes");
defineSymbol(math, math, op, "\u2a01", "\\bigoplus");
defineSymbol(math, math, op, "\u2a00", "\\bigodot");
defineSymbol(math, math, op, "\u222e", "\\oint");
defineSymbol(math, math, op, "\u2a06", "\\bigsqcup");
defineSymbol(math, math, op, "\u222b", "\\smallint");
defineSymbol(math, main, inner, "\u2026", "\\ldots");
defineSymbol(math, main, inner, "\u22ef", "\\cdots");
defineSymbol(math, main, inner, "\u22f1", "\\ddots");
defineSymbol(math, main, textord, "\u22ee", "\\vdots");
defineSymbol(math, main, accent, "\u00b4", "\\acute");
defineSymbol(math, main, accent, "\u0060", "\\grave");
defineSymbol(math, main, accent, "\u00a8", "\\ddot");
defineSymbol(math, main, accent, "\u007e", "\\tilde");
defineSymbol(math, main, accent, "\u00af", "\\bar");
defineSymbol(math, main, accent, "\u02d8", "\\breve");
defineSymbol(math, main, accent, "\u02c7", "\\check");
defineSymbol(math, main, accent, "\u005e", "\\hat");
defineSymbol(math, main, accent, "\u20d7", "\\vec");
defineSymbol(math, main, accent, "\u02d9", "\\dot");
defineSymbol(math, main, mathord, "\u0131", "\\imath");
defineSymbol(math, main, mathord, "\u0237", "\\jmath");

defineSymbol(text, main, spacing, "\u00a0", "\\ ");
defineSymbol(text, main, spacing, "\u00a0", " ");
defineSymbol(text, main, spacing, "\u00a0", "~");

// There are lots of symbols which are the same, so we add them in afterwards.
var i;
var ch;

// All of these are textords in math mode
var mathTextSymbols = "0123456789/@.\"";
for (i = 0; i < mathTextSymbols.length; i++) {
    ch = mathTextSymbols.charAt(i);
    defineSymbol(math, main, textord, ch, ch);
}

// All of these are textords in text mode
var textSymbols = "0123456789`!@*()-=+[]'\";:?/.,";
for (i = 0; i < textSymbols.length; i++) {
    ch = textSymbols.charAt(i);
    defineSymbol(text, main, textord, ch, ch);
}

// All of these are textords in text mode, and mathords in math mode
var letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
for (i = 0; i < letters.length; i++) {
    ch = letters.charAt(i);
    defineSymbol(math, main, mathord, ch, ch);
    defineSymbol(text, main, textord, ch, ch);
}
