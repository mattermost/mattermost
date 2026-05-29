// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

interface SettingsPageProps {
    activeSection: string;
    updateSection: (section: string) => void;
}

export function renderWithUserSettingsState<P extends SettingsPageProps>(
    Component: React.ComponentType<P>,
    props: React.ComponentProps<typeof Component>,
) {
    function FakeUserSettingsModal(otherProps: typeof props) {
        const [activeSection, setActiveSection] = useState('');

        return (
            <Component
                {...otherProps}
                activeSection={activeSection}
                updateSection={setActiveSection}
            />
        );
    }

    return renderWithContext(<FakeUserSettingsModal {...props}/>);
}
