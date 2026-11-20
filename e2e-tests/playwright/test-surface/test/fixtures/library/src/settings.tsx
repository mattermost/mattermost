import React from 'react';
import {useHistory} from 'react-router-dom';

import {Button, IconButton, Modal, Tabs} from 'compass';

export function SettingsModal({pinned}: {pinned: boolean}) {
    const history = useHistory();
    return (
        <Modal
            testId='library.settings_modal'
            title='Settings'
            showBackButton={true}
            onBack={() => history.push('/back')}
            onClose={() => history.push('/closed')}
        >
            <Tabs
                testId='library.settings_modal.tabs'
                tabs={[{key: 'info', label: 'Info'}]}
                activeKey='info'
                onChange={() => history.push('/tab')}
            />
            <IconButton
                testId='library.settings_modal.pin'
                toggled={pinned}
                aria-label='Pin'
            />
            <IconButton
                testId='library.settings_modal.edit'
                aria-label='Edit'
            />
            <Button
                testId='library.settings_modal.derived'
                data-testid='library.settings_modal.explicit--button'
            />
        </Modal>
    );
}
