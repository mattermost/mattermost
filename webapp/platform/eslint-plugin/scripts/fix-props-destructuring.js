#!/usr/bin/env node

/**
 * This script automatically fixes props destructuring issues flagged by the
 * @mattermost/no-props-destructuring ESLint rule.
 * 
 * It identifies React functional components that destructure props and converts them
 * to use props.propName instead.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get a list of all React component files
console.log('Finding React component files...');
const findComponentsCmd = 'find webapp/channels/src -type f -name "*.tsx" -o -name "*.jsx"';
const componentFiles = execSync(findComponentsCmd, { encoding: 'utf8' }).trim().split('\n');

console.log(`Found ${componentFiles.length} potential component files.`);

// Process each file
let fixedFiles = 0;
let fixedComponents = 0;

for (const filePath of componentFiles) {
  // Skip empty file paths
  if (!filePath) continue;
  
  // Read the file content
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Find functional component definitions with destructured props
  // Look for patterns like:
  // 1. function ComponentName({ prop1, prop2 }) {
  // 2. const ComponentName = ({ prop1, prop2 }) => {
  // 3. export const ComponentName = ({ prop1, prop2 }) => {
  // 4. export default function ComponentName({ prop1, prop2 }) {
  
  // Regular expressions to match component definitions
  const functionComponentRegex = /function\s+([A-Z][A-Za-z0-9_]*)\s*\(\s*\{\s*([^}]*)\s*\}\s*\)/g;
  const arrowComponentRegex = /(const|export const)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\(\s*\{\s*([^}]*)\s*\}\s*\)\s*=>/g;
  const exportDefaultFunctionRegex = /export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(\s*\{\s*([^}]*)\s*\}\s*\)/g;
  
  // Process function components
  let match;
  let newContent = content;
  
  // Process function declarations
  while ((match = functionComponentRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const componentName = match[1];
    const propsStr = match[2];
    
    // Skip if there are no props
    if (!propsStr.trim()) continue;
    
    // Create the replacement with 'props' instead of destructuring
    const replacement = `function ${componentName}(props)`;
    newContent = newContent.replace(fullMatch, replacement);
    
    // Replace prop usages in the component body
    const props = propsStr.split(',').map(p => p.trim());
    for (const prop of props) {
      // Skip complex patterns
      if (!prop || prop.includes(':') || prop.includes('=') || prop.includes('...')) {
        continue;
      }
      
      // Replace standalone prop references with props.prop
      const propRegex = new RegExp(`\\b${prop}\\b(?!\\s*:)`, 'g');
      newContent = newContent.replace(propRegex, `props.${prop}`);
    }
    
    modified = true;
    fixedComponents++;
  }
  
  // Process arrow function components
  while ((match = arrowComponentRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const exportType = match[1];
    const componentName = match[2];
    const propsStr = match[3];
    
    // Skip if there are no props
    if (!propsStr.trim()) continue;
    
    // Create the replacement with 'props' instead of destructuring
    const replacement = `${exportType} ${componentName} = (props) =>`;
    newContent = newContent.replace(fullMatch, replacement);
    
    // Replace prop usages in the component body
    const props = propsStr.split(',').map(p => p.trim());
    for (const prop of props) {
      // Skip complex patterns
      if (!prop || prop.includes(':') || prop.includes('=') || prop.includes('...')) {
        continue;
      }
      
      // Replace standalone prop references with props.prop
      const propRegex = new RegExp(`\\b${prop}\\b(?!\\s*:)`, 'g');
      newContent = newContent.replace(propRegex, `props.${prop}`);
    }
    
    modified = true;
    fixedComponents++;
  }
  
  // Process export default function components
  while ((match = exportDefaultFunctionRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const componentName = match[1];
    const propsStr = match[2];
    
    // Skip if there are no props
    if (!propsStr.trim()) continue;
    
    // Create the replacement with 'props' instead of destructuring
    const replacement = `export default function ${componentName}(props)`;
    newContent = newContent.replace(fullMatch, replacement);
    
    // Replace prop usages in the component body
    const props = propsStr.split(',').map(p => p.trim());
    for (const prop of props) {
      // Skip complex patterns
      if (!prop || prop.includes(':') || prop.includes('=') || prop.includes('...')) {
        continue;
      }
      
      // Replace standalone prop references with props.prop
      const propRegex = new RegExp(`\\b${prop}\\b(?!\\s*:)`, 'g');
      newContent = newContent.replace(propRegex, `props.${prop}`);
    }
    
    modified = true;
    fixedComponents++;
  }
  
  // Write the modified content back to the file if changes were made
  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    fixedFiles++;
    console.log(`Fixed ${filePath}`);
  }
}

console.log(`\nSummary:`);
console.log(`- Processed ${componentFiles.length} files`);
console.log(`- Fixed ${fixedFiles} files`);
console.log(`- Fixed ${fixedComponents} component definitions`);
