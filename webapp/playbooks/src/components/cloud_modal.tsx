import React from 'react';
import {useSelector} from 'react-redux';

import {isCloud} from 'src/license';

const CloudModal = () => {
    const isServerCloud = useSelector(isCloud);

    if (!isServerCloud) {
        return null;
    }

    // @ts-ignore
    const PurchaseModal = window.Components.PurchaseModal;

    if (!PurchaseModal) {
        // eslint-disable-next-line no-console
        console.error('unable to mount PurchaseModal component');

        return null;
    }

    return <PurchaseModal/>;
};

export default CloudModal;
