# Automated Accessibility Scan Testing Guidelines

## Overview

This guide focuses on **automated accessibility testing** using a **simplified, comprehensive approach**. Use axe-core's default rule set and scope testing to specific elements, disabling rules only when necessary. This maximizes coverage while minimizing maintenance overhead.

## Testing Philosophy

### **Core Principle: Scope and Analyze**

Use axe-core's comprehensive default rule set and scope testing to specific elements.

**Benefits:**

- **Maximum Coverage** - All WCAG 2.1 AA rules by default
- **Low Maintenance** - No rule lists to maintain
- **Future-Proof** - New axe-core rules automatically included
- **Clear Intent** - Disabled rules are explicit and documented

### **Basic Pattern**

```typescript
test('page accessibility', async ({axe, page}) => {
    const results = await axe.builder(page).analyze(); // All applicable rules

    expect(results.violations).toHaveLength(0);
});
```

```typescript
test('component accessibility', async ({axe, page}) => {
    const results = await axe
        .builder(page)
        .include('#element') // Scope to element
        .analyze(); // All applicable rules

    expect(results.violations).toHaveLength(0);
});
```

## What Can Be Automated

### **Fully Automatable**

- **HTML Structure & Semantics** - Markup validity, semantic elements, heading hierarchy
- **ARIA Implementation** - Attributes, states, relationships, roles
- **Form Accessibility** - Labels, validation, error messages
- **Interactive Elements** - Focus capability, accessible names
- **Color and Contrast** - WCAG AA/AAA contrast ratios
- **Alternative Text** - Image alt text presence
- **Table Structure** - Headers, captions, relationships
- **Navigation** - Skip links, landmarks, focus order

### **Cannot Be Fully Automated**

- **Cognitive Accessibility** - Content readability, comprehension
- **Contextual Appropriateness** - Alt text quality, meaningful link text
- **Real User Experience** - Actual keyboard workflows, screen reader UX
- **Content Quality** - Clear instructions, effective error messaging

## Testing Patterns

### **1. Component Testing**

```typescript
test('modal accessibility', async ({axe, page}) => {
    await page.getByRole('button', {name: 'Open modal'}).click();

    const results = await axe.builder(page).include('[role="dialog"]').analyze();

    expect(results.violations).toHaveLength(0);
});
```

### **2. State Testing**

```typescript
test('form error state accessibility', async ({axe, page}) => {
    // Test normal state
    let results = await axe.builder(page).include('form').analyze();
    expect(results.violations).toHaveLength(0);

    // Test error state
    await page.getByRole('button', {name: 'Submit'}).click();
    results = await axe.builder(page).include('form').analyze();
    expect(results.violations).toHaveLength(0);
});
```

## Rule Management

### **When to Disable Rules**

**Disable Rules Only When:**

- **Known UI Framework Limitations** - Theme-related contrast issues
- **Context-Inappropriate Rules** - Page-level rules in modal dialogs
- **Temporary Workarounds** - With clear documentation and tracking

### **Examples**

```typescript
// Good - Documented limitation
test('dark theme modal', async ({axe, page}) => {
    const results = await axe
        .builder(page)
        .include('[role="dialog"]')
        .disableRules([
            'color-contrast', // TODO: MM-nnn - Color contrast improvement
        ])
        .analyze();
});

// Good - Context on comment
test('modal dialog', async ({axe, page}) => {
    const results = await axe
        .builder(page)
        .include('[role="dialog"]')
        .disableRules([
            'page-has-heading-one', // Not applicable to modals
            'landmark-one-main', // Not applicable to modals
        ])
        .analyze();
});
```

**Don't Disable Rules For:**

- **Convenience** - "This rule is annoying"
- **Lack of Understanding** - "I don't know what this rule does"
- **Time Pressure** - "We'll fix it later" (without tracking)
