import React from 'react';

// a component with a top-level scope of its own (no container), rendered inside another scope's element
function Snippet() {
    return <span data-testid='snippet.text--text'/>;
}

export function Card() {
    return (
        <div data-testid='card'>
            <button data-testid='card.open--button'/>
            <Snippet/>
        </div>
    );
}
