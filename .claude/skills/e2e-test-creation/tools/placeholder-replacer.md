# Placeholder Replacer Tool

This tool replaces placeholder test keys (MM-TXXX) with actual Zephyr test case keys in generated test files.

## Purpose

When skeleton test files are generated, they use "MM-TXXX" as a placeholder. After creating test cases in Zephyr and receiving actual keys (e.g., MM-T1234), this tool updates all occurrences in the codebase.

## Algorithm

1. **Find Files**: Locate all `.spec.ts` files containing "MM-TXXX"
2. **Create Mapping**: Map placeholder to actual Zephyr key based on test objective/name
3. **Replace**: Update test titles, comments, and metadata
4. **Verify**: Ensure no placeholders remain

## Implementation

### TypeScript Implementation

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface KeyMapping {
  placeholder: string;
  actualKey: string;
  testName: string;
  filePath: string;
}

/**
 * Replace MM-TXXX placeholders with actual Zephyr keys
 */
export async function replacePlaceholders(
  mappings: KeyMapping[],
  baseDir: string
): Promise<void> {
  const files = await glob(`${baseDir}/**/*.spec.ts`);

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;

    for (const mapping of mappings) {
      const placeholderPattern = new RegExp(
        `test\\('${mapping.placeholder}`,
        'g'
      );

      if (content.includes(mapping.placeholder)) {
        content = content.replace(
          placeholderPattern,
          `test('${mapping.actualKey}`
        );
        modified = true;
        console.log(`✓ Replaced ${mapping.placeholder} → ${mapping.actualKey} in ${file}`);
      }
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf-8');
    }
  }
}

/**
 * Extract test metadata from file
 */
export function extractTestMetadata(filePath: string): {
  placeholder: string;
  objective: string;
  testName: string;
} | null {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract objective from JSDoc
  const objectiveMatch = content.match(/@objective\s+(.+)/);
  const objective = objectiveMatch ? objectiveMatch[1].trim() : '';

  // Extract test title with MM-TXXX
  const testMatch = content.match(/test\('(MM-TXXX)\s+(.+?)'/);

  if (!testMatch) return null;

  return {
    placeholder: testMatch[1],
    testName: testMatch[2],
    objective
  };
}

/**
 * Verify no placeholders remain
 */
export async function verifyNoPlaceholders(baseDir: string): Promise<boolean> {
  const files = await glob(`${baseDir}/**/*.spec.ts`);
  const filesWithPlaceholders: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('MM-TXXX')) {
      filesWithPlaceholders.push(file);
    }
  }

  if (filesWithPlaceholders.length > 0) {
    console.error('⚠️  Placeholders still found in:');
    filesWithPlaceholders.forEach(f => console.error(`  - ${f}`));
    return false;
  }

  console.log('✓ All placeholders replaced successfully');
  return true;
}
```

### Shell Script Implementation

```bash
#!/bin/bash
# replace-placeholders.sh

# Usage: ./replace-placeholders.sh <spec_dir> <mappings_file>
SPEC_DIR="$1"
MAPPINGS_FILE="$2"

if [ ! -f "$MAPPINGS_FILE" ]; then
  echo "Error: Mappings file not found: $MAPPINGS_FILE"
  exit 1
fi

# Read mappings JSON file
# Format: [{"placeholder": "MM-TXXX", "actualKey": "MM-T1234", "filePath": "login.spec.ts"}]

while IFS= read -r line; do
  PLACEHOLDER=$(echo "$line" | jq -r '.placeholder')
  ACTUAL_KEY=$(echo "$line" | jq -r '.actualKey')
  FILE_PATH=$(echo "$line" | jq -r '.filePath')

  FULL_PATH="$SPEC_DIR/$FILE_PATH"

  if [ -f "$FULL_PATH" ]; then
    # Replace in test title
    sed -i.bak "s/test('${PLACEHOLDER}/test('${ACTUAL_KEY}/g" "$FULL_PATH"

    # Remove backup file
    rm -f "${FULL_PATH}.bak"

    echo "✓ Replaced $PLACEHOLDER → $ACTUAL_KEY in $FILE_PATH"
  else
    echo "⚠️  File not found: $FULL_PATH"
  fi
done < <(jq -c '.[]' "$MAPPINGS_FILE")

# Verify no placeholders remain
REMAINING=$(grep -r "MM-TXXX" "$SPEC_DIR" --include="*.spec.ts" | wc -l)

if [ "$REMAINING" -gt 0 ]; then
  echo "⚠️  Warning: $REMAINING occurrences of MM-TXXX still found"
  grep -r "MM-TXXX" "$SPEC_DIR" --include="*.spec.ts"
  exit 1
else
  echo "✓ All placeholders replaced successfully"
fi
```

## Usage Examples

### TypeScript Usage

```typescript
import { replacePlaceholders, verifyNoPlaceholders } from './placeholder-replacer';

const mappings = [
  {
    placeholder: 'MM-TXXX',
    actualKey: 'MM-T1234',
    testName: 'Test successful login',
    filePath: 'specs/functional/auth/login.spec.ts'
  },
  {
    placeholder: 'MM-TXXX',
    actualKey: 'MM-T1235',
    testName: 'Test unsuccessful login',
    filePath: 'specs/functional/auth/login_failure.spec.ts'
  }
];

// Replace placeholders
await replacePlaceholders(mappings, 'e2e-tests/playwright');

// Verify completion
const success = await verifyNoPlaceholders('e2e-tests/playwright');
if (!success) {
  throw new Error('Placeholder replacement incomplete');
}
```

### Shell Script Usage

```bash
# Create mappings file
cat > mappings.json <<EOF
[
  {
    "placeholder": "MM-TXXX",
    "actualKey": "MM-T1234",
    "filePath": "specs/functional/auth/login.spec.ts"
  },
  {
    "placeholder": "MM-TXXX",
    "actualKey": "MM-T1235",
    "filePath": "specs/functional/auth/login_failure.spec.ts"
  }
]
EOF

# Run replacement
./replace-placeholders.sh "e2e-tests/playwright" "mappings.json"
```

## Integration with Workflow

### Step-by-Step Process

1. **After Skeleton Generation**:
   - Files created with MM-TXXX placeholders
   - Store file paths and metadata

2. **After Zephyr Creation**:
   - Receive actual test keys from Zephyr API
   - Build mapping: {placeholder → actualKey}

3. **Run Replacement**:
   - Execute replacement tool
   - Update all test files

4. **Verification**:
   - Confirm no placeholders remain
   - Log successful replacements

### Example Workflow Integration

```typescript
// Stage 2: Generate skeleton files
const skeletonFiles = await generateSkeletonFiles(testPlan);
// Result: [
//   { path: 'login.spec.ts', placeholder: 'MM-TXXX', objective: '...' }
// ]

// Stage 3A: Create in Zephyr
const zephyrKeys = await createZephyrTestCases(skeletonFiles);
// Result: [
//   { key: 'MM-T1234', name: 'Test successful login' }
// ]

// Stage 3B: Build mappings
const mappings = skeletonFiles.map((file, index) => ({
  placeholder: file.placeholder,
  actualKey: zephyrKeys[index].key,
  testName: file.objective,
  filePath: file.path
}));

// Stage 3B: Replace placeholders
await replacePlaceholders(mappings, 'e2e-tests/playwright');

// Stage 3C: Generate full code (now with actual keys)
await generateFullPlaywrightCode(mappings);
```

## Edge Cases

### Multiple MM-TXXX in Same File
If a file contains multiple placeholder tests, each must be mapped individually:

```typescript
const content = `
test('MM-TXXX Login success', async () => {});
test('MM-TXXX Login failure', async () => {});
`;

// This requires unique identifiers per test
// Solution: Use test objective as additional matching criteria
```

### Best Practice: One placeholder per file
Generate one skeleton file per test scenario to avoid ambiguity.

## Error Handling

```typescript
try {
  await replacePlaceholders(mappings, baseDir);
  await verifyNoPlaceholders(baseDir);
} catch (error) {
  console.error('Replacement failed:', error);
  // Rollback strategy: restore from backup
  await restoreFromBackup(baseDir);
  throw error;
}
```

## Logging

Log all replacements for audit trail:

```typescript
import * as winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'placeholder-replacements.log' })
  ]
});

logger.info('Replacement executed', {
  timestamp: new Date().toISOString(),
  mappings: mappings.length,
  filesModified: modifiedFiles.length
});
```
