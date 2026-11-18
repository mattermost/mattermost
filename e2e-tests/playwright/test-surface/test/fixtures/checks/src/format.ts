// markup built as text for dangerouslySetInnerHTML: its testids are sites too
export function highlight(word: string): string {
    return `<span class="highlight" data-testid="checks.markup.highlight--text">${word}</span>`;
}

// a selector, not markup: no site
export function findHighlight(): Element | null {
    return document.querySelector('[data-testid="checks.markup.not_a_site"]');
}

// a keyed testid in a template with substitutions
export function mention(name: string, label: string): string {
    return `<a class="mention" data-testid="checks.markup.mention:${name}--link" href="/${name}">~${label}</a>`;
}
