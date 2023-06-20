// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    id: string;
    name: string;
    checked: boolean;
    label: string;
    updateOption: (checked: boolean, name: string) => void;
};

class TeamFilterCheckbox extends React.PureComponent<Props> {
    toggleOption = () => {
        const {checked, id, updateOption} = this.props;
        updateOption(!checked, id);
    };

    render() {
        const {
            checked,
            id,
            label,
            name,
        } = this.props;

        return (
            <div className='TeamFilterDropdown_checkbox'>
                <label>
                    <input
                        type='checkbox'
                        id={id}
                        name={name}
                        checked={checked}
                        onChange={this.toggleOption}
                    />

                    {label}
                </label>
            </div>
        );
    }
}

export default TeamFilterCheckbox;
