import React from 'react';

// a key built from two lists of 17: 289 values, past the 256 a template keeps
const ROWS = ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'r16', 'r17'] as const;
const COLS = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17'] as const;

export function CapGrid() {
    return (
        <div>
            {ROWS.map((r) => COLS.map((c) => (
                <span
                    key={r + c}
                    data-testid={`checks.cap.cell:${r}_${c}--text`}
                />
            )))}
        </div>
    );
}
