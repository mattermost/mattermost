// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    extractHeadingsFromContent,
    extractHeadingsFromDOM,
    scrollToHeading,
} from './page_outline';

describe('extractHeadingsFromContent', () => {
    it('should extract H1, H2, H3 headings from TipTap JSON', () => {
        const tiptapJSON = JSON.stringify({
            type: 'doc',
            content: [
                {
                    type: 'heading',
                    attrs: {level: 1, id: 'heading-1'},
                    content: [{type: 'text', text: 'Heading 1'}],
                },
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: 'Some content'}],
                },
                {
                    type: 'heading',
                    attrs: {level: 2, id: 'heading-2'},
                    content: [{type: 'text', text: 'Heading 2'}],
                },
                {
                    type: 'heading',
                    attrs: {level: 3, id: 'heading-3'},
                    content: [{type: 'text', text: 'Heading 3'}],
                },
            ],
        });

        const headings = extractHeadingsFromContent(tiptapJSON);

        expect(headings).toHaveLength(3);
        expect(headings[0]).toMatchObject({text: 'Heading 1', level: 1});
        expect(headings[1]).toMatchObject({text: 'Heading 2', level: 2});
        expect(headings[2]).toMatchObject({text: 'Heading 3', level: 3});
        expect(headings[0].id).toBe('heading-1');
        expect(headings[1].id).toBe('heading-2');
        expect(headings[2].id).toBe('heading-3');
    });

    it('should extract H1, H2, H3 headings from markdown', () => {
        const markdown = `
# Heading 1
Some content here
## Heading 2
More content
### Heading 3
Even more content
        `;

        const headings = extractHeadingsFromContent(markdown);

        expect(headings).toHaveLength(3);
        expect(headings[0]).toMatchObject({text: 'Heading 1', level: 1});
        expect(headings[1]).toMatchObject({text: 'Heading 2', level: 2});
        expect(headings[2]).toMatchObject({text: 'Heading 3', level: 3});
        expect(headings[0].id).toBe('heading-1');
        expect(headings[1].id).toBe('heading-2');
        expect(headings[2].id).toBe('heading-3');
    });

    it('should handle multiple headings of the same level', () => {
        const markdown = `
# First H1
## First H2
## Second H2
### First H3
### Second H3
### Third H3
# Second H1
        `;

        const headings = extractHeadingsFromContent(markdown);

        expect(headings).toHaveLength(7);
        expect(headings[0]).toMatchObject({text: 'First H1', level: 1, id: 'first-h1'});
        expect(headings[1]).toMatchObject({text: 'First H2', level: 2, id: 'first-h2'});
        expect(headings[2]).toMatchObject({text: 'Second H2', level: 2, id: 'second-h2'});
        expect(headings[6]).toMatchObject({text: 'Second H1', level: 1, id: 'second-h1'});
    });

    it('should handle duplicate heading text with collision suffixes', () => {
        const markdown = `
# Introduction
Some content
# Introduction
More content
# Introduction
Even more content
        `;

        const headings = extractHeadingsFromContent(markdown);

        expect(headings).toHaveLength(3);
        expect(headings[0]).toMatchObject({text: 'Introduction', id: 'introduction'});
        expect(headings[1]).toMatchObject({text: 'Introduction', id: 'introduction-2'});
        expect(headings[2]).toMatchObject({text: 'Introduction', id: 'introduction-3'});
    });

    it('should handle pages with no headings', () => {
        const markdown = 'Just some text with no headings';
        const headings = extractHeadingsFromContent(markdown);
        expect(headings).toHaveLength(0);
    });

    it('should handle empty content', () => {
        expect(extractHeadingsFromContent('')).toHaveLength(0);
        expect(extractHeadingsFromContent(null as any)).toHaveLength(0);
        expect(extractHeadingsFromContent(undefined as any)).toHaveLength(0);
    });

    it('should trim whitespace from heading text', () => {
        const markdown = `
#    Heading with spaces
##  Another heading
        `;

        const headings = extractHeadingsFromContent(markdown);

        expect(headings[0].text).toBe('Heading with spaces');
        expect(headings[1].text).toBe('Another heading');
    });

    it('should ignore headings deeper than H3', () => {
        const markdown = `
# H1
## H2
### H3
#### H4
##### H5
###### H6
        `;

        const headings = extractHeadingsFromContent(markdown);

        expect(headings).toHaveLength(3);
        expect(headings.map((h) => h.level)).toEqual([1, 2, 3]);
    });

    it('should handle headings with special characters', () => {
        const markdown = `
# Heading with *markdown* **bold**
## Heading with [link](url)
### Heading with \`code\`
        `;

        const headings = extractHeadingsFromContent(markdown);

        expect(headings).toHaveLength(3);
        expect(headings[0].text).toBe('Heading with *markdown* **bold**');
        expect(headings[0].id).toBe('heading-with-markdown-bold');
        expect(headings[1].text).toBe('Heading with [link](url)');
        expect(headings[1].id).toBe('heading-with-linkurl');
        expect(headings[2].text).toBe('Heading with `code`');
        expect(headings[2].id).toBe('heading-with-code');
    });

    it('should only match headings at start of line', () => {
        const markdown = `
# Valid heading
Some text # Not a heading
    # Indented (not a heading in markdown spec)
        `;

        const headings = extractHeadingsFromContent(markdown);

        expect(headings).toHaveLength(1);
        expect(headings[0].text).toBe('Valid heading');
        expect(headings[0].id).toBe('valid-heading');
    });
});

describe('extractHeadingsFromDOM', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should extract headings from DOM', () => {
        const pageDiv = document.createElement('div');
        pageDiv.setAttribute('data-page-id', 'page123');
        pageDiv.innerHTML = `
            <h1 id="h1">Heading 1</h1>
            <p>Some content</p>
            <h2 id="h2">Heading 2</h2>
            <h3 id="h3">Heading 3</h3>
        `;
        document.body.appendChild(pageDiv);

        const headings = extractHeadingsFromDOM('page123');

        expect(headings).toHaveLength(3);
        expect(headings[0]).toMatchObject({id: 'h1', text: 'Heading 1', level: 1});
        expect(headings[1]).toMatchObject({id: 'h2', text: 'Heading 2', level: 2});
        expect(headings[2]).toMatchObject({id: 'h3', text: 'Heading 3', level: 3});
    });

    it('should generate IDs for headings without id attribute', () => {
        const pageDiv = document.createElement('div');
        pageDiv.setAttribute('data-page-id', 'page123');
        pageDiv.innerHTML = `
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
        `;
        document.body.appendChild(pageDiv);

        const headings = extractHeadingsFromDOM('page123');

        expect(headings[0].id).toBe('heading-0');
        expect(headings[1].id).toBe('heading-1');
    });

    it('should return empty array if page element not found', () => {
        const headings = extractHeadingsFromDOM('non-existent-page');
        expect(headings).toHaveLength(0);
    });

    it('should return empty array if pageId is empty', () => {
        const headings = extractHeadingsFromDOM('');
        expect(headings).toHaveLength(0);
    });

    it('should return empty array if no headings in page', () => {
        const pageDiv = document.createElement('div');
        pageDiv.setAttribute('data-page-id', 'page123');
        pageDiv.innerHTML = '<p>Just text, no headings</p>';
        document.body.appendChild(pageDiv);

        const headings = extractHeadingsFromDOM('page123');
        expect(headings).toHaveLength(0);
    });

    it('should trim whitespace from heading text', () => {
        const pageDiv = document.createElement('div');
        pageDiv.setAttribute('data-page-id', 'page123');
        pageDiv.innerHTML = '<h1>  Heading with spaces  </h1>';
        document.body.appendChild(pageDiv);

        const headings = extractHeadingsFromDOM('page123');

        expect(headings[0].text).toBe('Heading with spaces');
    });

    it('should only extract h1, h2, h3 (not h4, h5, h6)', () => {
        const pageDiv = document.createElement('div');
        pageDiv.setAttribute('data-page-id', 'page123');
        pageDiv.innerHTML = `
            <h1>H1</h1>
            <h2>H2</h2>
            <h3>H3</h3>
            <h4>H4</h4>
            <h5>H5</h5>
            <h6>H6</h6>
        `;
        document.body.appendChild(pageDiv);

        const headings = extractHeadingsFromDOM('page123');

        expect(headings).toHaveLength(3);
        expect(headings.map((h) => h.level)).toEqual([1, 2, 3]);
    });
});

describe('scrollToHeading', () => {
    let mockElement: HTMLElement;
    let mockScrollIntoView: jest.Mock;

    beforeEach(() => {
        mockScrollIntoView = jest.fn();
        mockElement = document.createElement('h1');
        mockElement.id = 'test-heading';
        mockElement.scrollIntoView = mockScrollIntoView;
        document.body.appendChild(mockElement);

        jest.useFakeTimers();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.useRealTimers();
    });

    it('should scroll to heading with smooth behavior', () => {
        scrollToHeading('test-heading');

        expect(mockScrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
        });
    });

    it('should add highlighted class temporarily', () => {
        scrollToHeading('test-heading');

        expect(mockElement.classList.contains('highlighted')).toBe(true);

        jest.advanceTimersByTime(2000);

        expect(mockElement.classList.contains('highlighted')).toBe(false);
    });

    it('should handle non-existent heading ID gracefully', () => {
        expect(() => scrollToHeading('non-existent')).not.toThrow();
        expect(mockScrollIntoView).not.toHaveBeenCalled();
    });

    it('should handle empty heading ID', () => {
        expect(() => scrollToHeading('')).not.toThrow();
        expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
});
