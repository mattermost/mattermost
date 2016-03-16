#!/usr/bin/env node
// Simple CLI for KaTeX.
// Reads TeX from stdin, outputs HTML to stdout.
/* eslint no-console:0 */

var katex = require("./");
var input = "";

// Skip the first two args, which are just "node" and "cli.js"
var args = process.argv.slice(2);

if (args.indexOf("--help") !== -1) {
    console.log(process.argv[0] + " " + process.argv[1] +
                " [ --help ]" +
                " [ --display-mode ]");

    console.log("\n" +
                "Options:");
    console.log("  --help            Display this help message");
    console.log("  --display-mode    Render in display mode (not inline mode)");
    process.exit();
}

process.stdin.on("data", function(chunk) {
    input += chunk.toString();
});

process.stdin.on("end", function() {
    var options = { displayMode: args.indexOf("--display-mode") !== -1 };
    var output = katex.renderToString(input, options);
    console.log(output);
});
