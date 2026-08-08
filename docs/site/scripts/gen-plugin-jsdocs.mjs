#!/usr/bin/env node
// Generates docs/site/data/plugin-jsdocs.json, the data source consumed by the <PluginJsDocs />
// component that renders the web app plugin SDK reference
// (docs/develop/integrate/reference/webapp/webapp-reference.md).
//
// Port of the old mattermost-developer-documentation repo's scripts/plugin-jsdocs.js, adapted to
// read webapp/channels/src/plugins/registry.ts directly from this monorepo instead of fetching it
// from GitHub over HTTP. Uses the TypeScript compiler API (already a devDependency here) instead
// of @typescript-eslint/typescript-estree to avoid adding a new dependency.
//
// Usage: node scripts/gen-plugin-jsdocs.mjs   (from docs/site/)

import ts from 'typescript';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // docs/site/scripts
const SITE_ROOT = resolve(HERE, '..'); // docs/site
const REPO_ROOT = resolve(SITE_ROOT, '../..'); // mattermost/
const REGISTRY_PATH = resolve(REPO_ROOT, 'webapp/channels/src/plugins/registry.ts');
const OUT_PATH = resolve(SITE_ROOT, 'data/plugin-jsdocs.json');

function paramNamesFromBindingName(name) {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isObjectBindingPattern(name)) {
    return name.elements.flatMap((el) => paramNamesFromBindingName(el.name));
  }
  if (ts.isArrayBindingPattern(name)) {
    return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : paramNamesFromBindingName(el.name)));
  }
  return [];
}

function leadingComments(sourceText, node) {
  const ranges = ts.getLeadingCommentRanges(sourceText, node.getFullStart()) || [];
  const lines = [];
  for (const range of ranges) {
    const text = sourceText.slice(range.pos, range.end);
    const stripped = text.replace(/^\/\*\*?/, '').replace(/\*\/$/, '').replace(/^\/\//, '');
    for (const rawLine of stripped.split('\n')) {
      const line = rawLine.replace(/^\s*\*\s?/, '').trimEnd();
      if (line.length > 0) lines.push(line);
    }
  }
  return lines;
}

function reArgParameterNames(callExpr) {
  const {expression: callee, arguments: args} = callExpr;
  if (ts.isIdentifier(callee) && callee.text === 'reArg') {
    const firstArg = args[0];
    if (firstArg && ts.isArrayLiteralExpression(firstArg)) {
      return firstArg.elements.filter(ts.isStringLiteralLike).map((el) => el.text);
    }
  }
  const arrowArg = args.find(ts.isArrowFunction);
  if (arrowArg) {
    return arrowArg.parameters.flatMap((p) => paramNamesFromBindingName(p.name));
  }
  return [];
}

function findPluginRegistryClass(sourceFile) {
  let found;
  sourceFile.forEachChild((node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === 'PluginRegistry') found = node;
  });
  return found;
}

function main() {
  const sourceText = readFileSync(REGISTRY_PATH, 'utf8');
  const sourceFile = ts.createSourceFile(REGISTRY_PATH, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const classDecl = findPluginRegistryClass(sourceFile);
  if (!classDecl) {
    throw new Error(`Could not find "export default class PluginRegistry" in ${REGISTRY_PATH}`);
  }

  const methods = [];
  for (const member of classDecl.members) {
    if (ts.isConstructorDeclaration(member)) continue;
    if (!member.name || !ts.isIdentifier(member.name)) continue;

    let params;
    if (ts.isMethodDeclaration(member)) {
      params = member.parameters.flatMap((p) => paramNamesFromBindingName(p.name));
    } else if (ts.isPropertyDeclaration(member) && member.initializer && ts.isCallExpression(member.initializer)) {
      params = reArgParameterNames(member.initializer);
    } else {
      continue;
    }

    methods.push({
      Name: member.name.text,
      Parameters: params,
      Comments: leadingComments(sourceText, member),
    });
  }

  const output = {Interface: {Methods: methods}};

  mkdirSync(dirname(OUT_PATH), {recursive: true});
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[plugin-jsdocs] wrote ${methods.length} methods to ${OUT_PATH}`);
}

main();
