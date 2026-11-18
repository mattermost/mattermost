import React from 'react';

// a shared grid with several hosts: one passes a literal list of rows, the other an empty list it fills with push()
// (like the admin DataGrid on the system roles page); the second host's row testid must still be recorded
type GridRow = {testKey?: string; label: string};
function Grid({rows, testIdScope}: {rows: GridRow[]; testIdScope: `values.${string}`}) {
    return (
        <div>
            {rows.map((row, index) => (
                <div
                    key={index}
                    data-testid={`${testIdScope}.row:${row.testKey ?? String(index)}`}
                >
                    {row.label}
                </div>
            ))}
        </div>
    );
}
export function FixedGrid() {
    return (
        <Grid
            testIdScope='values.fixed_grid'
            rows={[{testKey: 'a', label: 'A'}, {testKey: 'b', label: 'B'}]}
        />
    );
}
export function PushedGrid({names}: {names: string[]}) {
    const rows: GridRow[] = [];
    names.forEach((name) => {
        rows.push({testKey: name, label: name});
    });
    return (
        <Grid
            testIdScope='values.pushed_grid'
            rows={rows}
        />
    );
}
