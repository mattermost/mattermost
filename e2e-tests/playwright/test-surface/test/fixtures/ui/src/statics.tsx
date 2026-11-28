import React from 'react';

// a class item wrapped in a HOC and reached through a static of another class (`<Menu.ItemSubMenu/>`)
class SubItem extends React.PureComponent<{testId?: string; label: string}> {
    render() {
        return (
            <button data-testid={this.props.testId ? `${this.props.testId}--button` : undefined}>
                {this.props.label}
            </button>
        );
    }
}

function withLabel<P>(Component: React.ComponentType<P>) {
    return Component;
}

const LabelledSubItem = withLabel(SubItem);

class ItemList extends React.PureComponent<{children: React.ReactNode}> {
    static SubItem = LabelledSubItem;

    render() {
        return <ul>{this.props.children}</ul>;
    }
}

export function StaticItems() {
    return (
        <ItemList>
            <ItemList.SubItem
                testId='static_items.more'
                label='More'
            />
        </ItemList>
    );
}
