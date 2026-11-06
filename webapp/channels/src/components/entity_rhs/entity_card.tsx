// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {EntityCard} from '@mattermost/types/posts';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {isUseMilitaryTime} from 'selectors/preferences';

import {BlockRenderer} from 'components/block_renderer';
import {translateMMBlocks} from 'components/block_renderer/translation/mm_block';
import ExternalLink from 'components/external_link';

import type {GlobalState} from 'types/store';

const severityMessages = defineMessages({
    critical: {
        id: 'entity_card.severity.critical',
        defaultMessage: 'Critical',
    },
    high: {
        id: 'entity_card.severity.high',
        defaultMessage: 'High',
    },
    medium: {
        id: 'entity_card.severity.medium',
        defaultMessage: 'Medium',
    },
    low: {
        id: 'entity_card.severity.low',
        defaultMessage: 'Low',
    },
    none: {
        id: 'entity_card.severity.none',
        defaultMessage: 'None',
    },
});

const rule = '1px solid rgba(var(--center-channel-color-rgb), 0.08)';

const severityStyle: Record<string, React.CSSProperties> = {
    critical: {background: '#b3261e', color: '#ffffff'},
    high: {background: '#d9531e', color: '#ffffff'},
    medium: {background: '#f2b21b', color: '#1f1f1f'},
    low: {background: '#3b7fc4', color: '#ffffff'},
    none: {background: 'rgba(var(--center-channel-color-rgb), 0.12)', color: 'var(--center-channel-color)'},
};

const badge: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    lineHeight: '18px',
    fontWeight: 600,
};

const title: React.CSSProperties = {
    fontSize: 20,
    lineHeight: '26px',
    fontWeight: 600,
    margin: '4px 0 0',
    overflowWrap: 'anywhere',
};

const ident: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    letterSpacing: '0.04em',
    opacity: 0.6,
    margin: '2px 0 0',
};

const summaryStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: '20px',
    margin: '16px 0 0',
    overflowWrap: 'anywhere',
};

const labelCell: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: 600,
    opacity: 0.64,
    padding: '9px 12px 9px 0',
    verticalAlign: 'top',
    width: '34%',
    borderTop: rule,
};

const valueCell: React.CSSProperties = {
    padding: '8px 0',
    overflowWrap: 'anywhere',
    verticalAlign: 'top',
    borderTop: rule,
    fontSize: 13,
};

function hostOf(url: string) {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

function externalHref(value: string) {
    if (value.startsWith('https://') || value.startsWith('http://')) {
        return value;
    }
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..')) {
        return value;
    }
    return '';
}

function ValueText({value}: {value: string}) {
    const href = externalHref(value);
    if (!href) {
        return <>{value}</>;
    }
    return (
        <ExternalLink
            href={href}
            location='entity_card'
        >{value}</ExternalLink>
    );
}

function RelatedValue({
    link,
    onOpen,
}: {
    link: NonNullable<EntityCard['related']>[number];
    onOpen?: (target: EntityOpenTarget) => void;
}) {
    if (link.type_id && link.text && onOpen) {
        return (
            <button
                type='button'
                onClick={() => onOpen({typeId: link.type_id!, value: link.text!, label: link.label})}
                style={{background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--link-color)', cursor: 'pointer', textAlign: 'left'}}
            >{link.text}</button>
        );
    }
    const href = link.url ? externalHref(link.url) : '';
    if (href) {
        return (
            <ExternalLink
                href={href}
                location='entity_card'
            >{link.text || link.label}</ExternalLink>
        );
    }
    return <span>{link.text}</span>;
}

const Summary = ({text}: {text: string}) => {
    const [expanded, setExpanded] = useState(false);
    const long = text.length > 420;
    return (
        <div>
            <p style={long && !expanded ? {...summaryStyle, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden'} : summaryStyle}>{text}</p>
            {long && (
                <button
                    type='button'
                    onClick={() => setExpanded(!expanded)}
                    style={{border: 'none', background: 'none', padding: 0, color: 'var(--link-color)', cursor: 'pointer', fontSize: 13}}
                >
                    {expanded ? (
                        <FormattedMessage
                            id='entity_card.show_less'
                            defaultMessage='Show less'
                        />
                    ) : (
                        <FormattedMessage
                            id='entity_card.show_more'
                            defaultMessage='Show more'
                        />
                    )}
                </button>
            )}
        </div>
    );
};

export type EntityOpenTarget = {
    typeId: string;
    value: string;
    label?: string;
};

function formatCardInstant(instant: number, timeZone: string | undefined, military: boolean, intl: ReturnType<typeof useIntl>) {
    const date = new Date(instant);
    const zone = timeZone || undefined;
    return intl.formatDate(date, {
        timeZone: zone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: military ? 'h23' : 'h12',
        timeZoneName: 'short',
    });
}

export default function EntityCardView({card, onOpen, reload}: {card: EntityCard; onOpen?: (target: EntityOpenTarget) => void; reload?: () => void}) {
    const intl = useIntl();
    const timezone = useSelector(getCurrentTimezone);
    const military = useSelector(isUseMilitaryTime);
    const parts = useSelector((state: GlobalState) => state.plugins.components.EntityCardPart);
    const mapParts = parts.filter((part) => part.part === 'map');
    const clockParts = parts.filter((part) => part.part === 'clocks');
    const extraParts = parts.filter((part) => part.part !== 'map' && part.part !== 'clocks');
    const severity = card.severity && Object.hasOwn(severityStyle, card.severity) ? card.severity : '';
    const cardHref = card.url ? externalHref(card.url) : '';
    const bodyBlocks = useMemo(
        () => (Array.isArray(card.blocks) && card.blocks.length > 0 ? translateMMBlocks(card.blocks) : []),
        [card.blocks],
    );
    const hasBlockBody = bodyBlocks.length > 0;
    const urlInRows = Boolean(!hasBlockBody && cardHref && card.rows?.some((row) => row.value === card.url));
    const localInstant = card.instant ? formatCardInstant(card.instant, timezone, military, intl) : '';
    const heading = localInstant || card.title;

    return (
        <div data-testid='entity-card'>
            <h3 style={title}>{heading}</h3>
            {(localInstant || card.title !== card.value) && <p style={ident}>{card.value}</p>}
            {(severity || card.exploited) && (
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10}}>
                    {severity && (
                        <span
                            data-testid='entity-severity'
                            style={{...badge, ...severityStyle[severity]}}
                        >
                            {card.score && <span style={{fontWeight: 700}}>{card.score}</span>}
                            <FormattedMessage {...severityMessages[severity as keyof typeof severityMessages]}/>
                        </span>
                    )}
                    {card.exploited && (
                        <span
                            data-testid='entity-exploited'
                            style={{...badge, background: 'rgba(210, 75, 78, 0.12)', color: 'var(--error-text, #d24b4e)', boxShadow: 'inset 0 0 0 1px var(--error-text, #d24b4e)'}}
                        >
                            <FormattedMessage
                                id='entity_card.known_exploited'
                                defaultMessage='Known exploited'
                            />
                        </span>
                    )}
                </div>
            )}
            {hasBlockBody ? (
                <div
                    style={{marginTop: 16}}
                    data-testid='entity-card-blocks'
                >
                    <BlockRenderer
                        blocks={bodyBlocks}
                        postId=''
                        onAction={async () => undefined}
                        interactionsDisabled={true}
                    />
                </div>
            ) : (
                card.summary && <Summary text={card.summary}/>
            )}
            {card.map && Boolean(card.map.points?.length || card.map.geojson) && (
                mapParts.length > 0 ? mapParts.map((part) => {
                    const Part = part.component;
                    return (
                        <Part
                            key={part.id}
                            card={card}
                            reload={reload}
                        />
                    );
                }) : (
                    card.map.points && card.map.points.length > 0 && (
                        <p style={{marginTop: 16, color: 'var(--center-channel-color)'}}>
                            {card.map.points.map((point) => `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`).join(' · ')}
                        </p>
                    )
                )
            )}
            {clockParts.map((part) => {
                const Part = part.component;
                return (
                    <Part
                        key={part.id}
                        card={card}
                        reload={reload}
                    />
                );
            })}
            {!hasBlockBody && card.rows && card.rows.length > 0 && (
                <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 16}}>
                    <tbody>
                        {card.rows.map((row) => (
                            <tr key={row.label}>
                                <th
                                    scope='row'
                                    style={labelCell}
                                >{row.label}</th>
                                <td style={valueCell}><ValueText value={row.value}/></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {cardHref && !urlInRows && (
                <p style={{marginTop: 16}}>
                    <ExternalLink
                        href={cardHref}
                        location='entity_card'
                        data-testid='entity-card-link'
                    >{card.url}</ExternalLink>
                </p>
            )}
            {!hasBlockBody && card.vector && card.vector.length > 0 && (
                <>
                    <p style={{...labelCell, display: 'block', width: 'auto', borderTop: 'none', margin: '24px 0 8px', padding: 0}}>
                        <FormattedMessage
                            id='entity_card.vector_decoded'
                            defaultMessage='Vector, decoded'
                        />
                    </p>
                    <dl style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 12px', margin: 0, fontSize: 13}}>
                        {card.vector.map((metric) => (
                            <React.Fragment key={metric.metric}>
                                <dt style={{margin: 0, opacity: 0.72}}>{metric.metric}</dt>
                                <dd style={{margin: 0, textAlign: 'right', color: metric.severe ? 'var(--error-text, #d24b4e)' : undefined, fontWeight: metric.severe ? 600 : 400}}>{metric.value}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                </>
            )}
            {card.related && card.related.length > 0 && (
                <>
                    <p style={{...labelCell, display: 'block', width: 'auto', borderTop: 'none', margin: '24px 0 8px', padding: 0}}>
                        <FormattedMessage
                            id='entity_card.related'
                            defaultMessage='Related'
                        />
                    </p>
                    <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                        {card.related.map((link) => (
                            <li
                                key={link.label}
                                style={{display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(var(--center-channel-color-rgb), 0.04)'}}
                            >
                                <span style={{...ident, margin: 0}}>{link.label}</span>
                                <RelatedValue
                                    link={link}
                                    onOpen={onOpen}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {!hasBlockBody && card.sections?.map((section) => (
                <details
                    key={section.title}
                    style={{marginTop: 16, borderTop: rule, paddingTop: 12}}
                >
                    <summary style={{fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, cursor: 'pointer'}}>
                        <span style={{opacity: 0.64}}>{section.title}</span>
                        <span style={{marginLeft: 6, padding: '0 6px', borderRadius: 8, background: 'rgba(var(--center-channel-color-rgb), 0.08)'}}>{section.count}</span>
                    </summary>
                    <div style={{marginTop: 10, fontSize: 13}}>
                        {section.items && section.items.length > 0 ? section.items.map((item) => (
                            <div
                                key={item.url || item.head}
                                style={{padding: '6px 0', borderBottom: '1px solid rgba(var(--center-channel-color-rgb), 0.04)'}}
                            >
                                {item.url ? (
                                    <ExternalLink
                                        href={item.url}
                                        location='entity_card'
                                    >{hostOf(item.url)}</ExternalLink>
                                ) : <span>{item.head}</span>}
                                {item.text && <div style={{opacity: 0.64}}>{item.text}</div>}
                            </div>
                        )) : section.url && (
                            <ExternalLink
                                href={section.url}
                                location='entity_card'
                            >
                                <FormattedMessage
                                    id='entity_card.open_full_list'
                                    defaultMessage='Open the full list'
                                />
                            </ExternalLink>
                        )}
                    </div>
                </details>
            ))}
            {extraParts.map((part) => {
                const Part = part.component;
                return (
                    <Part
                        key={part.id}
                        card={card}
                        reload={reload}
                    />
                );
            })}
        </div>
    );
}
