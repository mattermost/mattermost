#!/usr/bin/env node
// Generates docs/site/data/plugin-jsdocs.json, the data source consumed by the <PluginJsDocs />
// component that renders the web app plugin SDK reference
// (docs/develop/integrate/reference/webapp/webapp-reference.md).
//
// Reads webapp/channels/src/plugins/registry.ts directly from this monorepo instead of fetching it
// from GitHub over HTTP.
//
// Usage: node scripts/gen-plugin-jsdocs.mjs   (from docs/site/)

import {parse} from '@typescript-eslint/typescript-estree';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // docs/site/scripts
const SITE_ROOT = resolve(HERE, '..'); // docs/site
const REPO_ROOT = resolve(SITE_ROOT, '../..'); // mattermost/
const REGISTRY_PATH = resolve(REPO_ROOT, 'webapp/channels/src/plugins/registry.ts');
const OUT_PATH = resolve(SITE_ROOT, 'data/plugin-jsdocs.json');

function paramNamesFromPattern(pattern) {
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'ObjectPattern') {
    return pattern.properties.flatMap((prop) => (prop.type === 'Property' ? paramNamesFromPattern(prop.value) : paramNamesFromPattern(prop)));
  }
  if (pattern.type === 'ArrayPattern') {
    return pattern.elements.flatMap((el) => (el ? paramNamesFromPattern(el) : []));
  }
  if (pattern.type === 'AssignmentPattern') return paramNamesFromPattern(pattern.left);
  if (pattern.type === 'RestElement') return paramNamesFromPattern(pattern.argument);
  return [];
}

// Comments attached to `node`: walk backward from its start, collecting comments as long as only
// whitespace separates them from each other and from the node. Node-scoped, so unlike a global
// "which comments sit on consecutive lines" pass, it can't attribute a comment to the wrong member.
function leadingComments(sourceText, comments, node) {
  const attached = [];
  let cursor = node.range[0];
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    if (comment.range[1] > cursor) continue;
    if (!/^\s*$/.test(sourceText.slice(comment.range[1], cursor))) break;
    attached.unshift(comment);
    cursor = comment.range[0];
  }
  return attached.flatMap((comment) =>
    comment.value
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())
      .filter((line) => line.length > 0),
  );
}

// reArg(['name', ...], handler) documents its public parameter names explicitly in that array —
// that's the contract callers see, so prefer it over inferring names from the handler's own
// (possibly renamed or destructured) parameters.
function reArgParameterNames(callExpr) {
  const [firstArg, ...rest] = callExpr.arguments;
  if (callExpr.callee.type === 'Identifier' && callExpr.callee.name === 'reArg' && firstArg?.type === 'ArrayExpression') {
    return firstArg.elements.filter((el) => el?.type === 'Literal' && typeof el.value === 'string').map((el) => el.value);
  }
  const handler = rest.find((arg) => arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression');
  return handler ? handler.params.flatMap(paramNamesFromPattern) : [];
}

function findPluginRegistryClass(program) {
  return program.body.find(
    (statement) =>
      statement.type === 'ExportDefaultDeclaration' &&
      statement.declaration.type === 'ClassDeclaration' &&
      statement.declaration.id?.name === 'PluginRegistry',
  )?.declaration;
}

function main() {
  const sourceText = readFileSync(REGISTRY_PATH, 'utf8');
  const ast = parse(sourceText, {comment: true, range: true});

  const classDecl = findPluginRegistryClass(ast);
  if (!classDecl) {
    throw new Error(`Could not find "export default class PluginRegistry" in ${REGISTRY_PATH}`);
  }

  const methods = [];
  for (const member of classDecl.body.body) {
    if (member.key?.type !== 'Identifier') continue;

    let params;
    if (member.type === 'MethodDefinition' && member.kind !== 'constructor') {
      params = member.value.params.flatMap(paramNamesFromPattern);
    } else if (member.type === 'PropertyDefinition' && member.value?.type === 'CallExpression') {
      params = reArgParameterNames(member.value);
    } else {
      continue;
    }

    methods.push({
      Name: member.key.name,
      Parameters: params,
      Comments: leadingComments(sourceText, ast.comments, member),
    });
  }

  const output = {Interface: {Methods: methods}};

  mkdirSync(dirname(OUT_PATH), {recursive: true});
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[plugin-jsdocs] wrote ${methods.length} methods to ${OUT_PATH}`);
}

main();
