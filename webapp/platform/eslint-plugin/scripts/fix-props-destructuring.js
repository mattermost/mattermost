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

// Run ESLint to get the list of errors
console.log('Running ESLint to identify files with props destructuring...');
let eslintOutput;
try {
  eslintOutput = execSync('cd webapp/channels && npx eslint --ext .js,.jsx,.tsx,.ts ./src --quiet --format json', { encoding: 'utf8' });
} catch (error) {
  // ESLint will exit with error code if it finds issues, but we still want the output
  eslintOutput = error.stdout;
}

// Parse the JSON output from ESLint
const eslintResults = JSON.parse(eslintOutput);

// Group errors by file
const fileErrors = {};
eslintResults.forEach(result => {
  const filePath = result.filePath;
  
  // Only process files with no-props-destructuring errors
  const propsErrors = result.messages.filter(msg => 
    msg.ruleId === '@mattermost/no-props-destructuring'
  );
  
  if (propsErrors.length > 0) {
    fileErrors[filePath] = propsErrors.map(err => ({
      line: err.line,
      column: err.column
    }));
  }
});

console.log(`Found ${Object.keys(fileErrors).length} files with props destructuring issues.`);

// Process each file
let fixedFiles = 0;
for (const filePath in fileErrors) {
  console.log(`Processing ${filePath}...`);
  
  // Read the file content
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Get the errors for this file
  const errors = fileErrors[filePath];
  
  // Sort errors by line number in descending order to avoid position shifts
  errors.sort((a, b) => b.line - a.line);
  
  // Process each error
  for (const error of errors) {
    const lineIndex = error.line - 1;
    const line = lines[lineIndex];
    
    // Check if this is a function declaration or arrow function with destructured props
    if (line.includes('function') || line.includes('=>')) {
      // Find the parameter list
      const paramStart = line.indexOf('(');
      const paramEnd = findClosingBracket(line, paramStart);
      
      if (paramStart !== -1 && paramEnd !== -1) {
        const params = line.substring(paramStart + 1, paramEnd);
        
        // Check if the first parameter is destructured (has curly braces)
        if (params.trim().startsWith('{')) {
          // Extract the destructured properties
          const propsPattern = /\{\s*(.*?)\s*\}/;
          const match = propsPattern.exec(params);
          
          if (match) {
            const destructuredProps = match[1].split(',').map(p => p.trim());
            
            // Create a new parameter list with 'props' instead of destructuring
            const newParams = params.replace(propsPattern, 'props');
            
            // Replace the parameter list in the line
            const newLine = line.substring(0, paramStart + 1) + newParams + line.substring(paramEnd);
            lines[lineIndex] = newLine;
            
            // Now we need to replace all uses of the destructured props with props.propName
            // Find the function body
            let bodyStart = line.indexOf('{', paramEnd);
            if (bodyStart === -1) {
              // Arrow function might have implicit return or body on next line
              if (line.includes('=>')) {
                // Check if the body is on the same line after =>
                const arrowPos = line.indexOf('=>');
                if (line.substring(arrowPos + 2).trim().startsWith('{')) {
                  bodyStart = line.indexOf('{', arrowPos);
                } else {
                  // Implicit return or body on next line, we'll need to modify subsequent lines
                  // This is complex and might require more sophisticated parsing
                  console.log(`  Skipping complex arrow function on line ${error.line}`);
                  continue;
                }
              }
            }
            
            // If we found the body start, we need to find all references to the destructured props
            if (bodyStart !== -1) {
              // Find the matching closing brace for the function body
              const bodyEnd = findClosingBracket(content, bodyStart);
              
              if (bodyEnd !== -1) {
                // Extract the function body
                const bodyContent = content.substring(bodyStart, bodyEnd + 1);
                
                // Replace all references to destructured props
                let newBodyContent = bodyContent;
                for (const prop of destructuredProps) {
                  // Skip empty strings or complex patterns
                  if (!prop || prop.includes(':') || prop.includes('=') || prop.includes('...')) {
                    continue;
                  }
                  
                  // Create a regex that matches the prop name as a standalone identifier
                  const propRegex = new RegExp(`\\b${prop}\\b`, 'g');
                  newBodyContent = newBodyContent.replace(propRegex, `props.${prop}`);
                }
                
                // Replace the body in the content
                content = content.substring(0, bodyStart) + newBodyContent + content.substring(bodyEnd + 1);
                
                // Update the lines array
                lines.splice(lineIndex);
                Array.prototype.push.apply(lines, content.split('\n'));
              }
            }
          }
        }
      }
    }
  }
  
  // Write the modified content back to the file
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  fixedFiles++;
}

console.log(`Fixed ${fixedFiles} files.`);

// Helper function to find the closing bracket matching the opening bracket at the given position
function findClosingBracket(text, openPos) {
  const openBracket = text[openPos];
  let closeBracket;
  
  if (openBracket === '(') closeBracket = ')';
  else if (openBracket === '{') closeBracket = '}';
  else if (openBracket === '[') closeBracket = ']';
  else return -1;
  
  let depth = 1;
  for (let i = openPos + 1; i < text.length; i++) {
    if (text[i] === openBracket) depth++;
    else if (text[i] === closeBracket) {
      depth--;
      if (depth === 0) return i;
    }
  }
  
  return -1;
}
