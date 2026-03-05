import { parse } from '@typescript-eslint/typescript-estree';
import fetch from 'node-fetch';

// Parse the registry and extract the class methods, parameters and leading comments.
const response = await fetch('https://raw.githubusercontent.com/mattermost/mattermost/master/webapp/channels/src/plugins/registry.ts');
const registryContent = await response.text();
const registryParsed = parse(registryContent, { comment: true, loc: true });

const pluginRegistryClassMethods = registryParsed.body.find(statement =>
    statement.type === "ExportDefaultDeclaration" &&
    statement.declaration.id.name === "PluginRegistry"
).declaration.body.body.filter(statement =>
    statement.value !== null &&
        (statement.type === "MethodDefinition" || (statement.type === "PropertyDefinition" && statement.value.type === "CallExpression")) &&
        statement.key.name !== "constructor"
)

// Group all adjacent comments in commentBlocks.
let commentBlocks = [];
let lastLine = -2;
let currentBlock = [];
registryParsed.comments.forEach(comment => {
    if (comment.loc.start.line === (lastLine + 1)) {
        currentBlock.push(comment);
    } else {
        currentBlock = [comment];
        commentBlocks.push(currentBlock);
    }

    lastLine = comment.loc.start.line;
});

// Given a comment block, compute the number of its last line.
const blockLastLine = (commentBlock) => {
    const mapped = commentBlock.map(c => c.loc.start.line);
    return Math.max(...mapped);
};

// Generate a dictionary mapping every line with a preceding comment block to
// that specific block.
const lineToPrecedingBlock = {};
commentBlocks.forEach(block => {
    const line = blockLastLine(block) + 1;
    lineToPrecedingBlock[line] = block.map(comment => comment.value);
});

// For every method in the plugin registry, build an object with its name,
// its parameters and its preceding comment block.
const methodsOutput = pluginRegistryClassMethods.map((statement) => {
    const commentBlock = lineToPrecedingBlock[statement.loc.start.line];
    let params = [];
    if (statement.type === "PropertyDefinition" && "arguments" in statement.value) {
        const funcExpr = statement.value.arguments.filter(
            s => s.type === "ArrowFunctionExpression"
        );
        if (funcExpr && funcExpr[0]) {
            params = funcExpr[0].params.map(param => {
                return param.properties.map(prop => {
                    return prop.key.name;
                });
            });
        }
    } else {
        if (statement.value.params) {
            params = statement.value.params.map(param => param.name);
        }
    }
    return {
        Name: statement.key.name,
        Parameters: params,
        Comments: commentBlock ? commentBlock : [],
    }
});

const output = {
    Interface: {
        Methods: methodsOutput,
    },
};

process.stdout.write(JSON.stringify(output));
