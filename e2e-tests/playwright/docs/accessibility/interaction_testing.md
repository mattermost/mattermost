# Accessibility Interaction Testing Best Practices

## Overview

This guide covers **automated accessibility testing through user interaction simulation** using Playwright. These techniques test real user experiences with assistive technologies by automating keyboard navigation, focus management, and screen reader workflows.

## Core Capabilities

### **Keyboard Navigation Testing**

- **Arrow Key Navigation** - Menu and list traversal
- **Tab Navigation** - Focus order validation
- **Enter/Space Activation** - Button and link interaction
- **Escape Key Handling** - Modal and menu dismissal
- **Letter Key Shortcuts** - Quick navigation patterns

### **Focus Management Validation**

- **Focus Visibility** - `:focus-visible` state verification
- **Focus Trapping** - Modal and dialog containment
- **Focus Restoration** - Return focus after interactions
- **Focus Order** - Logical tab sequence validation

### **State and Behavior Testing**

- **ARIA State Changes** - `aria-expanded`, `aria-selected` verification
- **Dynamic Content** - Live region announcements
- **Error Handling** - Validation message accessibility
- **Loading States** - Progress indication accessibility

## Testing Patterns

### **1. Keyboard Navigation Testing**

```typescript
test('keyboard navigation through menu', async ({page}) => {
    // Open menu with keyboard
    await page.getByRole('button', {name: 'Menu'}).focus();
    await page.keyboard.press('Enter');

    // Navigate through menu items
    await expect(page.getByRole('menuitem').first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem').nth(1)).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem').nth(2)).toBeFocused();

    // Test wrapping behavior
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem').nth(1)).toBeFocused();

    // Close menu with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);

    // Verify focus restoration
    await expect(page.getByRole('button', {name: 'Menu'})).toBeFocused();
});
```

### **2. Focus Trapping in Modals**

```typescript
test('modal focus trapping', async ({page}) => {
    // Open modal
    await page.getByRole('button', {name: 'Open modal'}).click();
    const modal = page.getByRole('dialog');

    // Verify initial focus
    await expect(modal).toBeFocused();

    // Find all focusable elements in modal
    const focusableElements = modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const count = await focusableElements.count();

    // Tab through all elements
    for (let i = 0; i < count; i++) {
        await page.keyboard.press('Tab');
        await expect(focusableElements.nth(i)).toBeFocused();
    }

    // Verify focus wraps back to first element
    await page.keyboard.press('Tab');
    await expect(modal).toBeFocused(); // Or first focusable element

    // Test reverse tabbing
    await page.keyboard.press('Shift+Tab');
    await expect(focusableElements.last()).toBeFocused();
});
```

### **3. ARIA State Management Testing**

```typescript
test('expandable section ARIA states', async ({page}) => {
    const expandButton = page.getByRole('button', {name: 'Expand section', expanded: false});
    const expandableContent = page.getByRole('region', {name: 'Expandable content'});

    // Test initial collapsed state
    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    await expect(expandableContent).toBeHidden();

    // Expand with keyboard
    await expandButton.focus();
    await page.keyboard.press('Enter');

    // Verify expanded state
    await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    await expect(expandableContent).toBeVisible();

    // Verify focus moves to content
    await expect(expandableContent).toBeFocused();

    // Collapse with keyboard
    await expandButton.focus();
    await page.keyboard.press('Enter');

    // Verify collapsed state
    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    await expect(expandableContent).toBeHidden();
});
```

### **4. Form Validation Accessibility**

```typescript
test('form validation accessibility', async ({page}) => {
    const form = page.getByRole('form');
    const requiredField = form.getByRole('textbox', {name: 'Email'});
    const submitButton = form.getByRole('button', {name: 'Submit'});

    // Submit empty form to trigger validation
    await submitButton.focus();
    await page.keyboard.press('Enter');

    // Verify error state accessibility
    await expect(requiredField).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toBeVisible();

    // Verify focus moves to invalid field
    await expect(requiredField).toBeFocused();

    // Test error message association
    const errorId = await page.getByRole('alert').getAttribute('id');
    await expect(requiredField).toHaveAttribute('aria-describedby', errorId);

    // Fix validation error
    await requiredField.fill('valid@example.com');
    await submitButton.focus();
    await page.keyboard.press('Enter');

    // Verify error cleared
    await expect(requiredField).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByRole('alert')).toBeHidden();
});
```

### **5. Live Region Announcements**

```typescript
test('dynamic content announcements', async ({page}) => {
    const liveRegion = page.getByRole('status');
    const triggerButton = page.getByRole('button', {name: 'Load content'});

    // Verify live region setup
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    // Trigger content update
    await triggerButton.click();

    // Wait for content to appear in live region
    await expect(liveRegion).toContainText('Loading complete');

    // Test urgent announcements
    const urgentRegion = page.getByRole('alert');
    await page.getByRole('button', {name: 'Urgent action'}).click();
    await expect(urgentRegion).toContainText('Critical update');
});
```

### **6. Focus Visibility Testing**

```typescript
test('focus indicators visibility', async ({page}) => {
    const button = page.getByRole('button', {name: 'Save'});

    // Tab to button (should show focus indicator)
    await page.keyboard.press('Tab');
    await toBeFocusedWithFocusVisible(button);
});
```

### **7. Complex Navigation Patterns**

```typescript
test('hierarchical menu navigation', async ({page}) => {
    await page.getByRole('button', {name: 'Menu'}).focus();
    await page.keyboard.press('Enter');

    // Navigate to submenu trigger
    const submenuTrigger = page.getByRole('menuitem', {name: /has submenu/});
    await submenuTrigger.focus();

    // Open submenu with right arrow
    await page.keyboard.press('ArrowRight');

    // Verify submenu opened and focused
    const submenu = page.getByRole('menu').nth(1);
    await expect(submenu).toBeVisible();
    await expect(submenu.getByRole('menuitem').first()).toBeFocused();

    // Navigate in submenu
    await page.keyboard.press('ArrowDown');
    await expect(submenu.getByRole('menuitem').nth(1)).toBeFocused();

    // Return to parent menu with left arrow
    await page.keyboard.press('ArrowLeft');
    await expect(submenu).toBeHidden();
    await expect(submenuTrigger).toBeFocused();
});
```
