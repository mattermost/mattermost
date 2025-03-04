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

// Run ESLint to get the list of files with props destructuring issues
console.log('Running ESLint to identify files with props destructuring issues...');
let eslintOutput;
try {
  // Use --no-fix to prevent ESLint from trying to auto-fix, which can cause errors
  eslintOutput = execSync('cd webapp && npx eslint --no-fix --ext .js,.jsx,.tsx,.ts ./channels/src -f json', { 
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024 // Increase buffer size to handle large output
  });
} catch (error) {
  // ESLint will exit with error code if it finds issues, but we still want the output
  eslintOutput = error.stdout;
}

// Parse the JSON output from ESLint
let eslintResults;
try {
  eslintResults = JSON.parse(eslintOutput);
} catch (e) {
  console.error('Failed to parse ESLint output:', e);
  console.error('ESLint output:', eslintOutput.substring(0, 500) + '...');
  process.exit(1);
}

// Filter for files with props destructuring issues
const filesWithIssues = eslintResults
  .filter(result => result.messages.some(msg => msg.ruleId === '@mattermost/no-props-destructuring'))
  .map(result => result.filePath);

console.log(`Found ${filesWithIssues.length} files with props destructuring issues.`);

// Process each file
let fixedFiles = 0;
let fixedComponents = 0;

for (const filePath of filesWithIssues) {
  console.log(`Processing ${filePath}...`);
  
  // Read the file content
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Split the content into lines for easier processing
  const lines = content.split('\n');
  
  // Find all component function declarations with destructured props
  // We'll use a more comprehensive approach to find all patterns
  
  // Track component function declarations
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for various component patterns
    // Pattern 1: function Component({ props }) { ... }
    // Pattern 2: const Component = ({ props }) => { ... }
    // Pattern 3: export function Component({ props }) { ... }
    // Pattern 4: export default function Component({ props }) { ... }
    // Pattern 5: export const Component = ({ props }) => { ... }
    // Pattern 6: export default ({ props }) => { ... }
    
    // Check if this line contains a function declaration or arrow function with destructured props
    if (
      (line.includes('function') || line.includes('=>')) && 
      line.includes('{') && 
      line.includes('}') && 
      (
        // Check for capital letter component name or "Component" in the name
        /[A-Z]/.test(line) || 
        line.includes('Component') ||
        // Or check for export default which often indicates a component
        line.includes('export default')
      )
    ) {
      // Extract the parameter part
      const paramStart = line.indexOf('(');
      if (paramStart === -1) continue;
      
      const paramEnd = line.indexOf(')', paramStart);
      if (paramEnd === -1) continue;
      
      const params = line.substring(paramStart + 1, paramEnd);
      
      // Check if the parameter is destructured (has curly braces)
      if (params.trim().startsWith('{')) {
        // Extract the destructured properties
        const propsMatch = /\{\s*(.*?)\s*\}/.exec(params);
        if (!propsMatch) continue;
        
        const propsStr = propsMatch[1];
        const destructuredProps = propsStr.split(',').map(p => p.trim()).filter(p => p);
        
        // Skip if there are no props
        if (destructuredProps.length === 0) continue;
        
        // Create a new line with 'props' instead of destructuring
        let newLine = line.substring(0, paramStart + 1) + 'props' + line.substring(paramEnd);
        lines[i] = newLine;
        
        // Now we need to replace all uses of the destructured props with props.propName
        // We'll look ahead in the file to find all references
        
        // Find the function body
        let openBraces = 0;
        let inFunctionBody = false;
        let functionBodyStart = i;
        
        // If this is an arrow function with implicit return, we need special handling
        if (line.includes('=>') && !line.includes('{', line.indexOf('=>'))) {
          // For implicit returns, just process the current line
          for (const prop of destructuredProps) {
            // Skip complex patterns
            if (prop.includes(':') || prop.includes('=') || prop.includes('...')) {
              continue;
            }
            
            // Replace standalone prop references with props.prop
            const propRegex = new RegExp(`\\b${prop}\\b(?!\\s*:)`, 'g');
            lines[i] = lines[i].replace(propRegex, `props.${prop}`);
          }
        } else {
          // For regular functions or arrow functions with blocks, process the entire body
          for (let j = i; j < lines.length; j++) {
            const bodyLine = lines[j];
            
            // Count braces to find the function body
            for (let k = 0; k < bodyLine.length; k++) {
              if (bodyLine[k] === '{') {
                if (!inFunctionBody && j === i && k > line.indexOf(')')) {
                  inFunctionBody = true;
                  functionBodyStart = j;
                }
                openBraces++;
              } else if (bodyLine[k] === '}') {
                openBraces--;
                if (inFunctionBody && openBraces === 0) {
                  // We've found the end of the function body
                  // Now replace all prop references in the body
                  for (let l = functionBodyStart; l <= j; l++) {
                    for (const prop of destructuredProps) {
                      // Skip complex patterns
                      if (prop.includes(':') || prop.includes('=') || prop.includes('...')) {
                        continue;
                      }
                      
                      // Replace standalone prop references with props.prop
                      const propRegex = new RegExp(`\\b${prop}\\b(?!\\s*:)`, 'g');
                      lines[l] = lines[l].replace(propRegex, `props.${prop}`);
                    }
                  }
                  
                  // We're done with this function
                  modified = true;
                  fixedComponents++;
                  break;
                }
              }
            }
            
            if (inFunctionBody && openBraces === 0) {
              break;
            }
          }
        }
      }
    }
  }
  
  // Write the modified content back to the file if changes were made
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    fixedFiles++;
    console.log(`Fixed ${filePath}`);
  }
}

console.log(`\nSummary:`);
console.log(`- Found ${filesWithIssues.length} files with props destructuring issues`);
console.log(`- Fixed ${fixedFiles} files`);
console.log(`- Fixed ${fixedComponents} component definitions`);

// If there are still unfixed files, print them
if (fixedFiles < filesWithIssues.length) {
  console.log(`\nWarning: ${filesWithIssues.length - fixedFiles} files could not be automatically fixed.`);
  console.log('You may need to manually fix these files:');
  for (const filePath of filesWithIssues) {
    // Check if the file was modified
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('props.')) {
      console.log(`- ${filePath}`);
    }
  }
}
