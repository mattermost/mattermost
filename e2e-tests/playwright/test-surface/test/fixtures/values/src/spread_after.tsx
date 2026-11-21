import React from 'react';

// a rest spread after `area={area}` that can't carry `area` (its type has none) doesn't override it

type Finding = {area: string; id: string};

export function orderAreas(byArea: Record<string, Finding[]>): string[] {
    return Object.keys(byArea).sort((a, b) => a.localeCompare(b));
}

export const AreaAccordion = ({area, findings}: {area: string; findings: Finding[]} & RowState) => (
    <div data-testid={`values.spread_after.area:${area}`}>{findings.length}</div>
);

type RowState = {onMute: () => void};

export const FindingGroups = ({byArea, ...rowState}: {byArea: Record<string, Finding[]>} & RowState) => (
    <>
        {orderAreas(byArea).map((area) => (
            <AreaAccordion
                key={area}
                area={area}
                findings={byArea[area]}
                {...rowState}
            />
        ))}
    </>
);

export const Dashboard = ({byArea}: {byArea: Record<string, Finding[]>}) => <FindingGroups byArea={byArea} onMute={() => null}/>;
