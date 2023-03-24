import React from 'react';

import styled from 'styled-components';

import {CenteredRow} from 'src/components/backstage/styles';
import UpgradeSuccessIllustrationSvg from 'src/components/assets/upgrade_success_illustration_svg';
import UpgradeIllustrationSvg from 'src/components/assets/upgrade_illustration_svg';
import UpgradeErrorIllustrationSvg from 'src/components/assets/upgrade_error_illustration_svg';
import {ModalActionState} from 'src/components/backstage/upgrade_modal_data';

interface Props {
    state: ModalActionState;
}

const UpgradeModalIllustrationWrapper = (props: Props) => {
    let illustration;

    switch (props.state) {
    case ModalActionState.Success:
        illustration = <UpgradeSuccessIllustrationSvg/>;
        break;
    case ModalActionState.Error:
        illustration = <UpgradeErrorIllustrationSvg/>;
        break;
    default:
        illustration = <UpgradeIllustrationSvg/>;
        break;
    }

    return (
        <IllustrationWrapper>
            {illustration}
        </IllustrationWrapper>
    );
};

const IllustrationWrapper = styled(CenteredRow)`
    height: 156px;
`;

export default UpgradeModalIllustrationWrapper;
