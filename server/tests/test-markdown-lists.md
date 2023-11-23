# Markdown List Testing
Verify that all list types render as expected.

### Single-Item Ordered List

**Expected:**
```
7. Single Item
```

**Actual:**
7. Single Item

### Multi-Item Ordered List

**Expected:**
```
1. One
2. Two
3. Three
```

**Actual:**

1. One
1. Two
1. Three

### Nested Ordered List

**Expected:**
```
1. Alpha
    1. Bravo
2. Charlie
3. Delta
    1. Echo
    2. Foxtrot
```

**Actual:**

1. Alpha
  1. Bravo
1. Charlie
1. Delta
  1. Echo
  1. Foxtrot

### Single-Item Unordered List

**Expected:**
```
• Single Item
```

**Actual:**
* Single Item

### Multi-Item Unordered List

**Expected:**
```
• One
• Two
• Three
```

**Actual:**
* One
- Two
+ Three

### Multi-Item Unordered List with Line Break (Break should not render)

**Expected:**
```
• Item A
• Item B
• Item C
• Item D
```

**Actual:**
* Item A
+ Item B

- Item C
- Item D

### Nested Unordered List

**Expected:**
```
• Alpha
    • Bravo
• Charlie
• Delta
    • Echo
    • Foxtrot
```

**Actual:**
+ Alpha
    * Bravo
- Charlie
* Delta
    + Echo
    - Foxtrot

### Mixed List Starting Ordered

**Expected:**
```
1. One
2. Two
3. Three
```

**Actual:**

1. One
+ Two
- Three

### Mixed List Starting Unordered

**Expected:**
```
• Monday
• Tuesday
• Wednesday
```

**Actual:**
+ Monday
1. Tuesday
* Wednesday

### Nested Mixed List

**Expected:**
```
• Alpha
    1. Bravo
        • Charlie
        • Delta
• Echo
• Foxtrot
    • Golf
        1. Hotel
    • India
        1. Juliet
        2. Kilo
    • Lima
• Mike
    1. November
        4. Oscar
            5. Papa
```

**Actual:**
- Alpha
    1. Bravo
        * Charlie
        + Delta
- Echo
* Foxtrot
    + Golf
        1. Hotel
    - India
        1. Juliet
        2. Kilo
    * Lima
1. Mike
    1. November
        4. Oscar
            5. Papa

### Ordered Lists Separated by Carriage Returns

**Expected:**
```
1. One
  • Two
2. Two
3. Three
```

**Actual:**

1. One
    - Two

2. Two
3. Three

### New Line After a List

**Expected:**
```
1. One
2. Two

This text should be on a new line.
```

**Actual:**

1. One
2. Two
This text should be on a new line.

### Task Lists

**Expected:**
```
[ ] One
  [ ] Subpoint one
  - Normal Bullet
[ ] Two
[x] Completed item
```

**Actual:**

- [ ] One
  - [ ] Subpoint one
  - Normal Bullet
- [ ] Two
- [x] Completed item

### Numbered Task Lists

**Expected:**
```
1. [ ] One
2. [ ] Two
3. [x] Completed item
```

**Actual:**

1. [ ] One
2. [ ] Two
3. [x] Completed item

### Multiple Lists

**Expected:**
```
List A:

1. One

List B:

2. Two
```

List A:

1. One

List B:

2. Two

### Lists with blank lines before and after 

**Expected:**

```
Line with blank line after 

Line with blank line after and before 

1. Bullet 
2. Bullet 
3. Bullet 

Line with blank line after and before 

Line with blank line before
```
Line with blank line after 

Line with blank line after and before 

1. Bullet 
2. Bullet 
3. Bullet 

Line with blank line after and before 

Line with blank line before
