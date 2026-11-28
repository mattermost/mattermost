import React from 'react';

export default function Lazy({values}: {values: string[]}) {
    return (
        <span data-testid='lazy.label--text'>
            {values.map((v, i) => (
                <span
                    key={v}
                    data-testid={`lazy.chip:${i}`}
                />
            ))}
        </span>
    );
}
