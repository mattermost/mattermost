// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {PlaybookRun} from 'src/types/playbook_run';
import {useAllowPlaybookAttributes} from 'src/hooks/license';
import PropertiesList from 'src/components/rhs/properties_list';

import {Section, SectionHeader} from './rhs_info_styles';

interface Props {
    run: PlaybookRun;
    editable: boolean;
}

const RHSInfoProperties = (props: Props) => {
    const {formatMessage} = useIntl();
    const allowPlaybookAttributes = useAllowPlaybookAttributes();

    if (!allowPlaybookAttributes) {
        return null;
    }

    if (!props.run.property_fields || props.run.property_fields.length === 0) {
        return null;
    }

    return (
        <Section>
            <SectionHeader
                title={formatMessage({defaultMessage: 'Attributes'})}
            />
            <StyledPropertiesList
                propertyFields={props.run.property_fields}
                propertyValues={props.run.property_values}
                runID={props.run.id}
            />
        </Section>
    );
};

const StyledPropertiesList = styled(PropertiesList)`
    padding: 0 24px;

    /* Remove the individual property padding since section has padding */
    & > div {
        padding: 0;
    }
`;

export default RHSInfoProperties;