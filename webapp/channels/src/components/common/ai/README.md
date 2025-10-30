# AI Agent Dropdown Component

## Overview

The AI Agent Dropdown is a reusable React component that provides a dropdown interface for selecting AI agents/bots. It displays a list of available AI agents with their avatars and allows users to select one. The component follows Mattermost's design patterns and uses the existing Menu component infrastructure.

## Location

```
webapp/channels/src/components/common/ai/
├── ai_agent_dropdown.tsx      # Main component
├── ai_agent_dropdown.scss     # Styles
├── ai_agent_dropdown.test.tsx # Tests
├── types.ts                    # TypeScript type definitions
├── index.ts                    # Barrel export
└── README.md                   # This file
```

## Usage

### Basic Example

```typescript
import {AIAgentDropdown} from 'components/common/ai';
import type {BridgeBotInfo} from 'components/common/ai';

function MyComponent() {
    const [selectedBotId, setSelectedBotId] = useState<string>('copilot-bot-id');
    
    const bots: BridgeBotInfo[] = [
        {
            ID: 'copilot-bot-id',
            DisplayName: 'Copilot',
            Username: 'copilot',
            ServiceID: 'copilot-service',
            ServiceType: 'copilot',
        },
        // ... more bots
    ];

    return (
        <AIAgentDropdown
            selectedBotId={selectedBotId}
            onBotSelect={setSelectedBotId}
            bots={bots}
            defaultBotId='copilot-bot-id'
        />
    );
}
```

### Integration Example (create_recap_modal.tsx)

The component is currently integrated in the Create Recap Modal header:

```typescript
<div className='create-recap-modal-header-actions'>
    <AIAgentDropdown
        selectedBotId={selectedBotId}
        onBotSelect={handleBotSelect}
        bots={MOCK_BOTS}
        defaultBotId={DEFAULT_BOT_ID}
        disabled={isSubmitting}
    />
</div>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selectedBotId` | `string \| null` | Yes | - | The ID of the currently selected bot |
| `onBotSelect` | `(botId: string) => void` | Yes | - | Callback function called when a bot is selected |
| `bots` | `BridgeBotInfo[]` | Yes | - | Array of available bot options |
| `defaultBotId` | `string` | No | `undefined` | The ID of the default bot (displays "(default)" label) |
| `disabled` | `boolean` | No | `false` | Whether the dropdown is disabled |

## Types

### BridgeBotInfo

```typescript
interface BridgeBotInfo {
    ID: string;           // Unique identifier for the bot
    DisplayName: string;  // Human-readable name shown in UI
    Username: string;     // Bot username for avatar lookup
    ServiceID: string;    // ID of the service this bot belongs to
    ServiceType: string;  // Type of service (e.g., 'copilot', 'openai')
}
```

## Features

- ✅ Displays bot avatars using Mattermost's Avatar component
- ✅ Shows checkmark for currently selected bot
- ✅ Marks default bot with "(default)" label
- ✅ Supports keyboard navigation
- ✅ Accessible with proper ARIA labels
- ✅ Mobile-responsive (uses Mattermost's Menu component)
- ✅ Internationalized with react-intl
- ✅ Fully tested

## Future Enhancements

### Backend Integration

Currently, the dropdown uses hardcoded mock data. To integrate with the backend:

1. Create an API endpoint to fetch available bots:
   ```go
   GET /api/v4/bridge/bots
   ```

2. Add a Redux action to fetch bots:
   ```typescript
   // In mattermost-redux/actions/bridge.ts
   export function getBridgeBots() {
       return bindClientFunc({
           clientFunc: Client4.getBridgeBots,
           onRequest: BridgeTypes.GET_BRIDGE_BOTS_REQUEST,
           onSuccess: [BridgeTypes.RECEIVED_BRIDGE_BOTS, BridgeTypes.GET_BRIDGE_BOTS_SUCCESS],
           onFailure: BridgeTypes.GET_BRIDGE_BOTS_FAILURE,
       });
   }
   ```

3. Update the component to use Redux:
   ```typescript
   const bots = useSelector(getBridgeBots);
   const dispatch = useDispatch();
   
   useEffect(() => {
       dispatch(getBridgeBots());
   }, [dispatch]);
   ```

### Recommended Backend Response Format

```json
{
    "bots": [
        {
            "id": "bot-uuid-1",
            "display_name": "Copilot",
            "username": "copilot",
            "service_id": "service-uuid-1",
            "service_type": "copilot",
            "is_default": true
        },
        {
            "id": "bot-uuid-2",
            "display_name": "OpenAI",
            "username": "openai",
            "service_id": "service-uuid-2",
            "service_type": "openai",
            "is_default": false
        }
    ]
}
```

## Testing

Run tests with:
```bash
npm test -- ai_agent_dropdown.test.tsx
```

### Test Coverage

- ✅ Renders with selected bot name
- ✅ Renders placeholder when no bot is selected
- ✅ Opens menu when button is clicked
- ✅ Displays default label for default bot
- ✅ Calls onBotSelect when a bot is clicked
- ✅ Shows checkmark for selected bot
- ✅ Disables when disabled prop is true
- ✅ Renders all bots in the list
- ✅ Handles keyboard navigation
- ✅ Updates displayed name when selectedBotId changes
- ✅ Handles empty bots array

## Internationalization

The component uses the following i18n keys:

- `ai.agent.generateWith` - "GENERATE WITH:" label
- `ai.agent.selectBot` - Placeholder text when no bot selected
- `ai.agent.menuAriaLabel` - ARIA label for the menu
- `ai.agent.buttonAriaLabel` - ARIA label for the button
- `ai.agent.chooseBot` - Menu header text
- `ai.agent.default` - "default" label for default bot

## Design Specifications

Based on Figma design: [AI-Recaps](https://www.figma.com/design/lRCkQjEI8EUgCPIqSyrwyg/AI-Recaps?node-id=163-53503&m=dev)

### Visual States

1. **Default State**: Gray background (`rgba(var(--center-channel-color-rgb), 0.08)`)
2. **Hover State**: Slightly darker background (`rgba(var(--center-channel-color-rgb), 0.12)`)
3. **Active State**: Blue-tinted background (`rgba(var(--button-bg-rgb), 0.12)`)
4. **Disabled State**: 50% opacity, not-allowed cursor

### Typography

- **Label**: 11px, SemiBold, uppercase, 56% opacity
- **Button Text**: 11px, SemiBold
- **Menu Header**: 12px, SemiBold, uppercase, 56% opacity
- **Menu Item**: 14px, Regular

## Dependencies

- `@mattermost/compass-icons` - Icons (CheckIcon, ChevronDownIcon)
- `components/menu` - Menu container component
- `components/menu/menu_item` - Menu item component
- `components/widgets/users/avatar` - Avatar display
- `mattermost-redux/client` - Client4 for profile pictures
- `react-intl` - Internationalization

## Accessibility

- Full keyboard navigation support
- Proper ARIA labels and roles
- Screen reader friendly
- Focus management
- High contrast support through CSS variables

## Browser Support

Supports all browsers that Mattermost webapp supports (modern browsers with ES6+ support).

