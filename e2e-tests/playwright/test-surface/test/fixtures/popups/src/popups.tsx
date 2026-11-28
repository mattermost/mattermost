import React from 'react';

// a combobox renders its options in a portal, outside the scope's element
export function Picker({choices}: {choices: Array<{id: string; name: string}>}) {
    return (
        <div data-testid='popups.picker'>
            <input
                role='combobox'
                data-testid='popups.picker.value--combobox'
            />
            {choices.map((c) => (
                <div
                    key={c.id}
                    role='option'
                    data-testid={`popups.picker.choice:${c.id}--option`}
                >
                    {c.name}
                </div>
            ))}
        </div>
    );
}

// a listbox's options render inside it (one list of several on the page)
export function Suggestions({items}: {items: string[]}) {
    return (
        <div
            role='listbox'
            data-testid='popups.suggestions'
        >
            {items.map((i) => (
                <div
                    key={i}
                    role='option'
                    data-testid={`popups.suggestions.item:${i}--option`}
                >
                    {i}
                </div>
            ))}
        </div>
    );
}
