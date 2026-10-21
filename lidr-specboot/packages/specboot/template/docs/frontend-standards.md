---
description: Frontend development standards, best practices, and conventions for the LTI React application including component patterns, state management, UI/UX guidelines, and testing practices
globs: ["frontend/src/**/*.{js,jsx,ts,tsx}", "frontend/cypress/**/*.{ts,js}", "frontend/tsconfig.json", "frontend/cypress.config.ts", "frontend/package.json"]
alwaysApply: true
---

# Frontend Project Configuration and Best Practices

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
  - [Core Technologies](#core-technologies)
  - [UI Framework](#ui-framework)
  - [State Management & Data Flow](#state-management--data-flow)
  - [Testing Framework](#testing-framework)
  - [Development Tools](#development-tools)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
  - [Language and Naming Conventions](#language-and-naming-conventions)
  - [Component Conventions](#component-conventions)
  - [State Management](#state-management)
  - [Service Layer Architecture](#service-layer-architecture)
- [UI/UX Standards](#uiux-standards)
  - [Bootstrap Integration](#bootstrap-integration)
  - [Form Handling](#form-handling)
  - [Navigation Patterns](#navigation-patterns)
  - [Accessibility](#accessibility)
- [Testing Standards](#testing-standards)
  - [End-to-End Testing with Cypress](#end-to-end-testing-with-cypress)
  - [Test Organization](#test-organization)
- [Configuration Standards](#configuration-standards)
  - [TypeScript Configuration](#typescript-configuration)
  - [ESLint Configuration](#eslint-configuration)
  - [Environment Configuration](#environment-configuration)
- [Performance Best Practices](#performance-best-practices)
  - [Component Optimization](#component-optimization)
  - [Bundle Optimization](#bundle-optimization)
  - [API Efficiency](#api-efficiency)
- [Development Workflow](#development-workflow)
  - [Git Workflow](#git-workflow)
  - [Development Scripts](#development-scripts)
  - [Code Quality](#code-quality)
- [Migration Strategy](#migration-strategy)
  - [TypeScript Migration](#typescript-migration)
  - [Component Modernization](#component-modernization)

---

## Overview

This document outlines the best practices, conventions, and standards used in the LTI frontend application. These practices ensure code consistency, maintainability, and optimal development experience.

## Technology Stack

### Core Technologies
- **React 18.3.1**: Modern React with functional components and hooks
- **TypeScript 4.9.5**: For type safety and better development experience
- **Create React App 5.0.1**: Build tooling and development server
- **React Router DOM 6.23.1**: Client-side routing and navigation

### UI Framework
- **Bootstrap 5.3.3**: CSS framework for responsive design
- **React Bootstrap 2.10.2**: Bootstrap components for React
- **React Bootstrap Icons 1.11.4**: Icon library
- **React DatePicker 6.9.0**: Date input components

### State Management & Data Flow
- **React Hooks**: useState, useEffect for local state management
- **React Beautiful DND 13.1.1**: Drag and drop functionality
- **Axios**: HTTP client for API communication

### Testing Framework
- **Cypress 14.4.1**: End-to-end testing
- **Jest**: Unit testing (via Create React App)
- **React Testing Library**: Component testing utilities

### Development Tools
- **ESLint**: Code linting with React-specific rules
- **TypeScript**: Static type checking
- **Web Vitals**: Performance monitoring

## Project Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/        # Reusable UI components
│   ├── services/         # API service layer
│   ├── pages/           # Page components (future organization)
│   ├── assets/          # Images, fonts, static resources
│   ├── App.js           # Main application component
│   ├── index.tsx        # Application entry point
│   └── index.css        # Global styles
├── cypress/
│   └── e2e/            # End-to-end test files
├── package.json         # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── cypress.config.ts   # Cypress configuration
```

## Coding Standards

### Naming Conventions

- **Component Naming**: Use PascalCase for React components (e.g., `CandidateCard`, `PositionDetails`, `RecruiterDashboard`)
- **Variable Naming**: Use camelCase for variables and functions (e.g., `candidateId`, `handleSubmit`, `fetchPositions`)
- **Constants Naming**: Use UPPER_SNAKE_CASE for constants (e.g., `MAX_CANDIDATES_PER_PAGE`, `API_BASE_URL`)
- **Type/Interface Naming**: Use PascalCase for types and interfaces (e.g., `CandidateData`, `PositionProps`, `ICandidateService`)
- **File Naming**: Use PascalCase for component files (e.g., `CandidateCard.tsx`, `PositionDetails.tsx`) and camelCase for utility files (e.g., `candidateService.js`, `apiUtils.ts`)
- **CSS Class Naming**: Use kebab-case for CSS classes (e.g., `candidate-card`, `position-details`)
- **Hook Naming**: Use camelCase starting with "use" prefix (e.g., `useCandidate`, `usePositionData`, `useFormValidation`)

**Examples:**

```typescript
// Good: All in English
import React, { useState, useEffect } from 'react';

type CandidateCardProps = {
    candidate: Candidate;
    index: number;
    onClick: (candidate: Candidate) => void;
};

const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, index, onClick }) => {
    const [isLoading, setIsLoading] = useState(false);
    
    // Handle candidate card click event
    const handleCardClick = () => {
        onClick(candidate);
    };
    
    return (
        <div className="candidate-card" onClick={handleCardClick}>
            {/* Component JSX */}
        </div>
    );
};

// Avoid: Non-English comments or names
const TarjetaCandidato: React.FC<PropsTarjetaCandidato> = ({ candidato, indice, alHacerClic }) => {
    const [estaCargando, setEstaCargando] = useState(false);
    
    // Manejar evento de clic en la tarjeta de candidato
    const manejarClicTarjeta = () => {
        alHacerClic(candidato);
    };
    
    return (
        <div className="tarjeta-candidato" onClick={manejarClicTarjeta}>
            {/* JSX del componente */}
        </div>
    );
};
```

**Error Messages and Console Logs:**

```typescript
// Good: English error messages
catch (error) {
    console.error('Failed to fetch candidates:', error);
    setError('Unable to load candidates. Please try again later.');
}

// Avoid: Non-English messages
catch (error) {
    console.error('Error al obtener candidatos:', error);
    setError('No se pudieron cargar los candidatos. Por favor, inténtelo de nuevo más tarde.');
}
```

**Service Layer Examples:**

```typescript
// Good: English naming in services
export const candidateService = {
    getAllCandidates: async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/candidates`);
            return response.data;
        } catch (error) {
            console.error('Error fetching candidates:', error);
            throw error;
        }
    }
};

// Avoid: Non-English naming
export const servicioCandidatos = {
    obtenerTodosLosCandidatos: async () => {
        try {
            const respuesta = await axios.get(`${API_BASE_URL}/candidates`);
            return respuesta.data;
        } catch (error) {
            console.error('Error al obtener candidatos:', error);
            throw error;
        }
    }
};
```

### Component Conventions

#### Functional Components
- **Always use functional components** with hooks instead of class components
- Use **TypeScript for new components** when possible
- Keep **JavaScript for legacy components** until migration

```typescript
// Preferred - TypeScript functional component
import React, { useState, useEffect } from 'react';

type Position = {
    id: number;
    title: string;
    status: 'Open' | 'Contratado' | 'Cerrado' | 'Borrador';
};

const Positions: React.FC = () => {
    const [positions, setPositions] = useState<Position[]>([]);
    // Component logic
};
```

#### Component Props
- **Define TypeScript interfaces** for component props when using TypeScript
- Use **destructuring** for props
- Include **default values** where appropriate

```typescript
type CandidateCardProps = {
    candidate: Candidate;
    index: number;
    onClick: (candidate: Candidate) => void;
};

const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, index, onClick }) => {
    // Component implementation
};
```

### State Management

#### Local State with Hooks
- Use **useState** for component-level state
- Use **useEffect** for side effects and data fetching
- **Extract custom hooks** for reusable stateful logic

```javascript
const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'Borrador'
});

const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: value
    }));
};
```

#### Loading and Error States
- **Always handle loading states** for async operations
- **Implement error handling** with user-friendly messages
- **Use React Bootstrap Alert** components for feedback

```javascript
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');

// In async function
try {
    setLoading(true);
    const data = await apiCall();
    setSuccess('Operation completed successfully');
} catch (error) {
    setError('Error message: ' + error.message);
} finally {
    setLoading(false);
}
```

### Service Layer Architecture

#### API Services
- **Centralize API calls** in service files
- Use **axios** for HTTP requests
- **Export service objects** with grouped methods
- **Handle errors at service level** when appropriate

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3010';

export const positionService = {
    getAllPositions: async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/positions`);
            return response.data;
        } catch (error) {
            console.error('Error fetching positions:', error);
            throw error;
        }
    },
    
    updatePosition: async (id, positionData) => {
        try {
            const response = await axios.put(`${API_BASE_URL}/positions/${id}`, positionData);
            return response.data;
        } catch (error) {
            console.error('Error updating position:', error);
            throw error;
        }
    }
};
```

## UI/UX Standards

### Bootstrap Integration
- Use **React Bootstrap components** instead of plain Bootstrap
- **Import Bootstrap CSS** in the main App component
- Follow **Bootstrap responsive grid system** (Container, Row, Col)

```javascript
import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';
```

### Form Handling
- Use **controlled components** for form inputs
- Implement **real-time validation** where appropriate
- **Disable submit buttons** during form submission
- **Clear form state** after successful submission

```javascript
<Form onSubmit={handleSubmit}>
    <Form.Group className="mb-3">
        <Form.Label>Title *</Form.Label>
        <Form.Control
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
        />
    </Form.Group>
    <Button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
    </Button>
</Form>
```

### Navigation Patterns
- Use **React Router** for all navigation
- **Implement breadcrumbs** with back navigation
- Use **programmatic navigation** with useNavigate hook

```javascript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// Navigation examples
<Button variant="link" onClick={() => navigate('/')}>
    ← Back to Dashboard
</Button>
```

### Accessibility
- Include **aria-label** attributes for interactive elements
- Use **semantic HTML** elements
- Ensure **keyboard navigation** support
- Provide **alternative text** for images

```javascript
<Form.Control 
    type="text" 
    placeholder="Search by title" 
    aria-label="Search positions by title"
/>
```

## Testing Standards

### End-to-End Testing with Cypress
- **Test user workflows** rather than implementation details
- Use **data-testid** attributes for reliable element selection
- **Organize tests by feature** (candidates.cy.ts, positions.cy.ts)
- **Include API testing** alongside UI testing

```typescript
describe('Positions API - Update', () => {
    beforeEach(() => {
        cy.window().then((win) => {
            win.localStorage.clear();
        });
    });

    it('should update a position successfully', () => {
        const updateData = {
            title: 'Updated Test Position',
            status: 'Open'
        };

        cy.request({
            method: 'PUT',
            url: `${API_URL}/positions/${testPositionId}`,
            body: updateData
        }).then((response) => {
            expect(response.status).to.eq(200);
            expect(response.body.data.title).to.eq(updateData.title);
        });
    });
});
```

### Test Organization
- **Group related tests** with describe blocks
- **Use descriptive test names** that explain the expected behavior
- **Test both success and error scenarios**
- **Include edge cases** and validation testing

## Configuration Standards

### TypeScript Configuration
- Enable **strict mode** for type checking
- Use **path mapping** with "@/*" for cleaner imports
- Include **both Cypress and Node types**
- Configure **ES5 target** for broader compatibility

```json
{
    "compilerOptions": {
        "strict": true,
        "baseUrl": ".",
        "paths": {
            "@/*": ["src/*"]
        },
        "types": ["cypress", "node"]
    }
}
```

### ESLint Configuration
- Extend **React App** configuration
- Include **Jest rules** for testing
- **Automatic code formatting** and error detection
- **Consistent code style** across the project

### Environment Configuration
- Use **environment variables** for API URLs
- **Separate configurations** for development and production
- **Configure Cypress** with environment-specific settings

```javascript
// cypress.config.ts
export default defineConfig({
    e2e: {
        baseUrl: 'http://localhost:3000',
        env: {
            API_URL: 'http://localhost:3010'
        }
    }
});
```

## Performance Best Practices

### Component Optimization
- **Lazy load** components when appropriate
- **Memoize expensive calculations** with useMemo
- **Avoid unnecessary re-renders** with useCallback
- **Extract reusable logic** into custom hooks

### Bundle Optimization
- **Tree shaking** enabled through Create React App
- **Code splitting** at route level
- **Optimize images** and static assets
- **Monitor bundle size** with build tools

### API Efficiency
- **Implement proper error handling** for network requests
- **Cache API responses** where appropriate
- **Use loading states** to improve perceived performance
- **Batch API calls** when possible

## Development Workflow

- **Feature Branches**: Develop features in separate branches, adding descriptive suffix "-frontend" to allow working in parallel and avoid conflicts or collisions
- **Descriptive Commits**: Write descriptive commit messages in English
- **Code Review**: Code review before merging
- **Small Branches**: Keep branches small and focused

### Development Scripts
```bash
npm start          # Development server
npm test           # Run unit tests
npm run build      # Production build
npm run cypress:open    # Open Cypress test runner
npm run cypress:run     # Run Cypress tests headlessly
```

### Code Quality
- **ESLint validation** before commits
- **TypeScript compilation** without errors
- **All tests passing** before deployment
- **Performance monitoring** with Web Vitals

## Migration Strategy

### TypeScript Migration
- **Gradual migration** from JavaScript to TypeScript
- **New components in TypeScript** by default
- **Maintain existing JavaScript** components until planned refactor
- **Add types incrementally** to existing code

### Component Modernization
- **Functional components** over class components
- **Hooks** instead of lifecycle methods
- **React Bootstrap** components for consistency
- **Responsive design** principles throughout

This document serves as the foundation for maintaining code quality and consistency across the LTI frontend application. All team members should follow these practices to ensure a maintainable and scalable codebase.
