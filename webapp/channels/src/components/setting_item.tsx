// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode, RefObject} from 'react';

import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

type Props = {

    /**
     * Whether this setting item is currently open
     */
    active: boolean;

    /**
     * Whether all sections in the panel are currently closed
     */
    areAllSectionsInactive: boolean;

    /**
     * The identifier of this section
     */
    section: string;

    /**
     * The setting UI when it is maximized (open)
     */
    max: ReactNode;

    // Props to pass through for SettingItemMin
    updateSection: (section: string) => void;
    title?: ReactNode;
    isDisabled?: boolean;
    describe?: ReactNode;

    /**
     * Replacement in place of edit button when the setting (in collapsed mode) is disabled
     */
    collapsedEditButtonWhenDisabled?: ReactNode;
}

export default class SettingItem extends React.PureComponent<Props> {
    minRef: RefObject<SettingItemMinComponent>;

    constructor(props: Props) {
        super(props);

        this.minRef = React.createRef();
    }

    componentDidUpdate(prevProps: Props) {
        // We want to bring back focus to the edit button when the section is opened and then closed along with all sections are closed
        if (!this.props.active && prevProps.active && this.props.areAllSectionsInactive) {
            this.minRef.current?.focus();
        }
    }

    render() {
        if (this.props.active) {
            return this.props.max;
        }

        return (
            <SettingItemMin
                ref={this.minRef}
                title={this.props.title}
                updateSection={this.props.updateSection}
                describe={this.props.describe}
                section={this.props.section}
                isDisabled={this.props.isDisabled}
                collapsedEditButtonWhenDisabled={this.props.collapsedEditButtonWhenDisabled}
            />
        );
    }
}
