import React from 'react';
import { AllowedIPRange } from '@mattermost/types/config';

import './ip_filtering.scss';

type IPFilteringProps = {
    allowedIPRanges: AllowedIPRange[];
};

const IPFiltering = ({ allowedIPRanges }: IPFilteringProps) => {

    const AllowedIPRanges = [
        {
            CIDRBlock: '192.168.0.0/24',
            Description: 'Local network',
            Enabled: true,
            OwnerID: '1234',
        },
        {
            CIDRBlock: '10.0.0.0/8',
            Description: 'Private network',
            Enabled: true,
            OwnerID: '5678',
        },
    ];

    return (
        <>
            <div className="SectionHeaderContent">
                <div className="Frame1281">
                    <div className="TitleSubtitle">
                        <div className="Frame1286">
                            <div className="Title">Enable IP Filtering</div>
                            <div className="Subtitle">With IP filtering you can limit access to your workspace by IP addresses.</div>
                        </div>
                    </div>
                    {/* TODO: Implement the switch selector */}
                    <div className="Frame1282">
                        <div className="SwitchSelector">
                            <div className="Track"></div>
                            <div className="Knob"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="SectionContent">
                <div className="Table">
                    <div className="HeaderRow">
                        <div className="FilterName">Filter Name</div>
                        <div className="IpAddressRange">IP Address Range</div>
                    </div>
                    {AllowedIPRanges.map((allowedIPRange) => (
                        <div className="Row" key={allowedIPRange.CIDRBlock}>
                            <div className="FilterName">{allowedIPRange.Description}</div>
                            <div className="IpAddressRange">{allowedIPRange.CIDRBlock}</div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default IPFiltering;