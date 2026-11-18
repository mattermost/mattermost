import React from 'react';

import {Row} from './panel';

// nothing imports this file
export function Orphan() {
    return (
        <div>
            <button data-testid='orphan.go--button'/>
            <Row/>
        </div>
    );
}
