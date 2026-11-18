// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {AdminPanel, Button} from '@mattermost/compass-ui';

const styled = (_component: any) => (_css: TemplateStringsArray) => (_props: any) => null;

// a styled library component keeps the library component's role
const WideButton = styled(Button)`width: 100%;`;

export function Panel({onSave, onToggle}: {onSave: () => void; onToggle: (on: boolean) => void}) {
    return (

        // the header switch's handler doesn't make the panel itself a control
        <AdminPanel
            data-testid='roles.panel'
            title='Settings'
            onSwitchChange={onToggle}
        >
            <WideButton
                data-testid='roles.panel.save--button'
                onClick={onSave}
            />
        </AdminPanel>
    );
}
