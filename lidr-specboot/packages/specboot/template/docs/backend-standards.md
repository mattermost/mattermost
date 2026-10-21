---
description: Backend development standards, best practices, and conventions for the LTI Node.js/TypeScript/Express application including Domain-Driven Design, SOLID principles, architecture patterns, API design, and testing practices
globs: ["backend/src/**/*.ts", "backend/prisma/**/*.{prisma,ts}", "backend/jest.config.js", "backend/tsconfig.json", "backend/serverless.yml", "backend/package.json"]
alwaysApply: true
---

# Backend Project Standards and Best Practices

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
  - [Core Technologies](#core-technologies)
  - [Database & ORM](#database--orm)
  - [Testing Framework](#testing-framework)
  - [Development Tools](#development-tools)
- [Architecture Overview](#architecture-overview)
  - [Domain-Driven Design (DDD)](#domain-driven-design-ddd)
  - [Layered Architecture](#layered-architecture)
  - [Project Structure](#project-structure)
- [Domain-Driven Design Principles](#domain-driven-design-principles)
  - [Entities](#entities)
  - [Value Objects](#value-objects)
  - [Aggregates](#aggregates)
  - [Repositories](#repositories)
  - [Domain Services](#domain-services)
  - [Additional Recommendations](#additional-recommendations)
- [SOLID and DRY Principles](#solid-and-dry-principles)
  - [Single Responsibility Principle (SRP)](#single-responsibility-principle-srp)
  - [Open/Closed Principle (OCP)](#openclosed-principle-ocp)
  - [Liskov Substitution Principle (LSP)](#liskov-substitution-principle-lsp)
  - [Interface Segregation Principle (ISP)](#interface-segregation-principle-isp)
  - [Dependency Inversion Principle (DIP)](#dependency-inversion-principle-dip)
  - [DRY (Don't Repeat Yourself)](#dry-dont-repeat-yourself)
- [Coding Standards](#coding-standards)
  - [Language and Naming Conventions](#language-and-naming-conventions)
  - [TypeScript Usage](#typescript-usage)
  - [Error Handling](#error-handling)
  - [Validation Patterns](#validation-patterns)
  - [Logging Standards](#logging-standards)
- [API Design Standards](#api-design-standards)
  - [REST Endpoints](#rest-endpoints)
  - [Request/Response Patterns](#requestresponse-patterns)
  - [Error Response Format](#error-response-format)
  - [CORS Configuration](#cors-configuration)
- [Database Patterns](#database-patterns)
  - [Prisma Schema](#prisma-schema)
  - [Migrations](#migrations)
  - [Repository Pattern](#repository-pattern)
- [Testing Standards](#testing-standards)
  - [Unit Testing](#unit-testing)
  - [Integration Testing](#integration-testing)
  - [Test Coverage Requirements](#test-coverage-requirements)
  - [Mocking Standards](#mocking-standards)
- [Performance Best Practices](#performance-best-practices)
  - [Database Query Optimization](#database-query-optimization)
  - [Async/Await Patterns](#asyncawait-patterns)
  - [Error Handling Performance](#error-handling-performance)
- [Security Best Practices](#security-best-practices)
  - [Input Validation](#input-validation)
  - [Environment Variables](#environment-variables)
  - [Dependency Injection](#dependency-injection)
- [Development Workflow](#development-workflow)
  - [Git Workflow](#git-workflow)
  - [Development Scripts](#development-scripts)
  - [Code Quality](#code-quality)
- [Serverless Deployment](#serverless-deployment)
  - [AWS Lambda Configuration](#aws-lambda-configuration)
  - [Serverless Framework](#serverless-framework)

---

## Overview

This document outlines the best practices, conventions, and standards used in the LTI backend application. The backend follows Domain-Driven Design (DDD) principles and implements a layered architecture to ensure code consistency, maintainability, and scalability.

## Technology Stack

### Core Technologies
- **Node.js**: Runtime environment
- **TypeScript**: Type-safe development with strict mode
- **Express.js**: Web application framework
- **Prisma**: Modern ORM for database access

### Database & ORM
- **PostgreSQL**: Relational database (Docker container)
- **Prisma Client**: Type-safe database client
- **Prisma Migrate**: Database migration tool

### Testing Framework
- **Jest**: Testing framework with TypeScript support
- **Coverage Threshold**: 90% for branches, functions, lines, and statements
- **Test Location**: `__tests__` directories and `.test.ts` files

### Development Tools
- **ESLint**: Code linting
- **TypeScript Compiler**: Type checking and compilation
- **Serverless Framework**: AWS Lambda deployment support

## Architecture Overview

### Domain-Driven Design (DDD)

Domain-Driven Design is a methodology that focuses on modeling software according to business logic and domain knowledge. By centering development on a deep understanding of the domain, DDD facilitates the creation of complex systems.

**Benefits:**
- **Improved Communication**: Promotes a common language between developers and domain experts, improving communication and reducing interpretation errors.
- **Clear Domain Models**: Helps build models that accurately reflect business rules and processes.
- **High Maintainability**: By dividing the system into subdomains, it facilitates maintenance and software evolution.

### Layered Architecture

The backend follows a layered DDD architecture:

**Presentation Layer** (`src/presentation/`)
- Controllers handle HTTP requests/responses
- Routes define API endpoints
- Controllers use services from Application layer

**Application Layer** (`src/application/`)
- Services contain business logic and orchestration
- Validator handles input validation
- Services use repositories from Domain layer

**Domain Layer** (`src/domain/`)
- Models define core business entities (Candidate, Position, Application, Interview, etc.)
- Repository interfaces define data access contracts
- Pure business logic without external dependencies

**Infrastructure Layer** (implicit)
- Prisma ORM handles database operations
- Repository implementations (via Prisma) satisfy domain interfaces

### Project Structure

```
backend/
├── src/
│   ├── domain/
│   │   ├── models/          # Domain entities
│   │   └── repositories/    # Repository interfaces
│   ├── application/
│   │   ├── services/        # Business logic services
│   │   └── validator.ts     # Input validation
│   ├── presentation/
│   │   └── controllers/     # HTTP request handlers
│   ├── infrastructure/
│   │   ├── logger.ts        # Logging utilities
│   │   └── prismaClient.ts  # Prisma client setup
│   ├── routes/              # Express route definitions
│   ├── middleware/          # Express middleware
│   ├── index.ts             # Application entry point
│   └── lambda.ts            # AWS Lambda handler
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── test-utils/
│   ├── builders/            # Test data builders
│   └── mocks/               # Mock helpers
├── jest.config.js           # Jest configuration
├── tsconfig.json            # TypeScript configuration
├── serverless.yml           # Serverless Framework config
└── package.json             # Dependencies and scripts
```

## Domain-Driven Design Principles

### Entities

Entities are objects with a distinct identity that persists over time.

**Before:**
```typescript
// Previously, candidate data might have been handled as a simple JSON object without methods.
const candidate = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com'
};
```

**After:**
```typescript
export class Candidate {
    id?: number;
    firstName: string;
    lastName: string;
    email: string;
    
    // Constructor and methods that encapsulate business logic
    constructor(data: any) {
        this.id = data.id;
        this.firstName = data.firstName;
        this.lastName = data.lastName;
        this.email = data.email;
    }
}
```

**Explanation**: `Candidate` is an entity because it has a unique identifier (`id`) that distinguishes it from other candidates, even if other properties are identical.

**Best Practice**: Entities should encapsulate business logic related to their domain concept and maintain consistency of their internal state.

### Value Objects

Value Objects describe aspects of the domain without conceptual identity. They are defined by their attributes rather than an identifier.

**Before:**
```typescript
// Handling education information as a simple object
const education = {
    institution: 'University',
    degree: 'Bachelor',
    startDate: '2010-01-01',
    endDate: '2014-01-01'
};
```

**After:**
```typescript
export class Education {
    institution: string;
    title: string;
    startDate: Date;
    endDate?: Date;
    
    constructor(data: any) {
        this.institution = data.institution;
        this.title = data.title;
        this.startDate = new Date(data.startDate);
        this.endDate = data.endDate ? new Date(data.endDate) : undefined;
    }
}
```

**Explanation**: `Education` can be considered a Value Object in some contexts, as it describes a candidate's education without needing a unique identifier. However, in the current model, it has been assigned an id, which could contradict the pure definition of a Value Object in DDD.

**Recommendation**: Classes like `Education` and `WorkExperience` currently have unique identifiers, classifying them as entities. In many cases, these could be treated as Value Objects within the context of a `Candidate` aggregate. Consider removing unique identifiers from classes that should be Value Objects, or incorporating them as part of the Candidate document if using a NoSQL database.

### Aggregates

Aggregates are clusters of objects that must be treated as a unit. They have a root entity that enforces invariants and consistency boundaries.

**Before:**
```typescript
// Candidate and education data handled separately
const candidate = { id: 1, name: 'John Doe' };
const educations = [{ candidateId: 1, institution: 'University' }];
```

**After:**
```typescript
export class Candidate {
    id?: number;
    firstName: string;
    lastName: string;
    email: string;
    educations: Education[];
    
    constructor(data: any) {
        this.id = data.id;
        this.firstName = data.firstName;
        this.lastName = data.lastName;
        this.email = data.email;
        this.educations = data.educations?.map(edu => new Education(edu)) || [];
    }
}
```

**Explanation**: `Candidate` acts as an aggregate root that contains `Education`, `WorkExperience`, `Resume`, and `Application`. `Candidate` is the root of the aggregate, as the other entities only make sense in relation to a candidate.

**Recommendation**: Aggregates should be carefully designed to ensure that all operations within the aggregate boundary maintain consistency. Operations that affect `Education` and `WorkExperience` should be handled through the aggregate root, `Candidate`, to maintain integrity and encapsulation.

### Repositories

Repositories provide interfaces for accessing aggregates and entities, encapsulating data access logic.

**Before:**
```typescript
// Direct database access without abstraction
function getCandidateById(id: number) {
    return database.query('SELECT * FROM candidates WHERE id = ?', [id]);
}
```

**After:**
```typescript
export interface ICandidateRepository {
    findById(id: number): Promise<Candidate | null>;
    save(candidate: Candidate): Promise<Candidate>;
    findAll(): Promise<Candidate[]>;
}

export class CandidateRepository implements ICandidateRepository {
    async findById(id: number): Promise<Candidate | null> {
        const data = await prisma.candidate.findUnique({ where: { id } });
        return data ? new Candidate(data) : null;
    }
    
    async save(candidate: Candidate): Promise<Candidate> {
        // Implementation with Prisma
    }
}
```

**Explanation**: `CandidateRepository` provides a clear interface for accessing candidate data, encapsulating database access logic.

**Recommendation**: 
- Develop complete repository interfaces for each entity and aggregate, ensuring all database interactions for those entities pass through the repository
- Implement repository methods that handle collections of entities, such as lists of Candidates, that can be filtered or modified in bulk
- Use dependency injection to inject Prisma client into repositories

### Domain Services

Domain Services contain business logic that doesn't naturally belong to an entity or value object.

**Before:**
```typescript
// Loose functions to handle business logic
function calculateAge(candidate: any): number {
    const today = new Date();
    const birthDate = new Date(candidate.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}
```

**After:**
```typescript
export class CandidateService {
    static calculateAge(candidate: Candidate): number {
        const today = new Date();
        const birthDate = new Date(candidate.birthDate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
}
```

**Explanation**: `CandidateService` encapsulates business logic related to candidates, such as calculating age, providing a centralized and coherent point for handling these operations.

### Additional Recommendations

**Use of Factories**

Factories are useful in DDD to encapsulate the logic of creating complex objects, ensuring that all created objects comply with domain rules from the moment of creation.

**Recommendation**: Implement factories for the creation of entities and aggregates, especially those that are complex and require specific initial configuration that complies with business rules.

**Improvement in Relationship Modeling**

Relationships between entities and aggregates must be clear and consistent with business rules.

**Recommendation**: Review and possibly redesign relationships between entities to ensure they accurately reflect domain needs and rules. This may include removing unnecessary relationships or adding new relationships that facilitate business operations.

**Domain Events Integration**

Domain events are an important part of DDD and can be used to handle side effects of domain operations in a decoupled manner.

**Recommendation**: Implement a domain event system that allows entities and aggregates to publish events that other system components can handle without being tightly coupled to the entities that generate them.

## SOLID and DRY Principles

### SOLID Principles

SOLID principles are five object-oriented design principles that help create more understandable, flexible, and maintainable systems.

#### Single Responsibility Principle (SRP)

Each class should have a single responsibility or reason to change.

**Before:**
```typescript
// A method that handles multiple responsibilities: validation and data storage
function processCandidate(candidate: any) {
    if (!candidate.email.includes('@')) {
        console.error('Invalid email');
        return;
    }
    database.save(candidate);
    console.log('Candidate saved');
}
```

**After:**
```typescript
export class Candidate {
    // The class now only handles logic related to the candidate
    validateEmail(): void {
        if (!this.email.includes('@')) {
            throw new Error('Invalid email');
        }
    }
}

export class CandidateRepository {
    async save(candidate: Candidate): Promise<Candidate> {
        candidate.validateEmail();
        return await prisma.candidate.create({ data: candidate });
    }
}
```

**Explanation**: The `Candidate` class now has separate methods for validation, while the repository handles data persistence, complying with the single responsibility principle.

**Observation**: The `Candidate` class in `backend/src/domain/models/Candidate.ts` handles both business logic and data access logic.

**Recommendation**: Separate data access logic into a repository layer to adhere more closely to SRP.

#### Open/Closed Principle (OCP)

Software entities should be open for extension but closed for modification.

**Before:**
```typescript
// Direct modification of the class to add functionality
class Candidate {
    saveToDatabase() {
        // code to save to database
    }
    // To add new functionality, we modify the class directly
    sendEmail() {
        // code to send an email
    }
}
```

**After:**
```typescript
export class Candidate {
    saveToDatabase() {
        // code to save to database
    }
}

// Extend functionality without modifying the existing class
class CandidateWithEmail extends Candidate {
    sendEmail() {
        // code to send an email
    }
}
```

**Explanation**: The email sending functionality is extended in a subclass, keeping the original class closed for modifications but open for extensions.

**Observation**: The `addCandidate` function in `backend/src/application/services/candidateService.ts` directly instantiates `Candidate`, `Education`, `WorkExperience`, and `Resume` classes.

**Recommendation**: Use factory methods to create instances, allowing for easier extension without modifying existing code.

#### Liskov Substitution Principle (LSP)

Objects of a derived class should be replaceable with objects of the base class without altering the program's functionality.

**Before:**
```typescript
// Subclass that cannot completely replace its base class
class TemporaryCandidate extends Candidate {
    saveToDatabase() {
        throw new Error("Temporary candidates can't be saved.");
    }
}
```

**After:**
```typescript
class TemporaryCandidate extends Candidate {
    saveToDatabase() {
        // Appropriate implementation that allows temporary handling
        console.log("Handled temporarily");
        // Alternative: Save to temporary storage
    }
}
```

**Explanation**: `TemporaryCandidate` now provides an appropriate implementation that respects the base class contract, allowing substitution without errors.

**Observation**: Currently, there is no inheritance in use where LSP could be violated. The project uses composition over inheritance, which generally supports LSP.

**Recommendation**: Continue using composition to avoid LSP violations and ensure that any future inheritance structures allow derived classes to substitute their base classes without altering how the program works.

#### Interface Segregation Principle (ISP)

Many specific interfaces are better than a single general interface.

**Before:**
```typescript
// A large interface that small clients don't fully use
interface CandidateOperations {
    save(): void;
    validate(): void;
    sendEmail(): void;
    generateReport(): void;
}
```

**After:**
```typescript
interface SaveOperation {
    save(): void;
}

interface EmailOperations {
    sendEmail(): void;
}

interface ReportOperations {
    generateReport(): void;
}

class Candidate implements SaveOperation, EmailOperations {
    save() {
        // implementation
    }
    
    sendEmail() {
        // implementation
    }
}
```

**Explanation**: Interfaces are segregated into smaller operations, allowing classes to implement only the interfaces they need.

**Observation**: The project does not currently use TypeScript interfaces extensively to enforce contracts for classes.

**Recommendation**: Define more granular interfaces for service classes to ensure they only implement the methods they need.

#### Dependency Inversion Principle (DIP)

High-level modules should not depend on low-level modules; both should depend on abstractions.

**Before:**
```typescript
// Direct dependency on a concrete implementation
class Candidate {
    private database = new PrismaClient();
    
    save() {
        this.database.candidate.create({ data: this });
    }
}
```

**After:**
```typescript
interface Database {
    save(candidate: Candidate): Promise<Candidate>;
}

class Candidate {
    private database: Database;
    
    constructor(database: Database) {
        this.database = database;
    }
    
    async save(): Promise<Candidate> {
        return await this.database.save(this);
    }
}
```

**Explanation**: `Candidate` now depends on an abstraction (Database), not a concrete implementation, which facilitates flexibility and code testing.

**Observation**: Classes like `Candidate` directly depend on the concrete `PrismaClient` for database operations.

**Recommendation**: Use dependency injection to invert the dependency, relying on abstractions rather than concrete implementations. Inject `PrismaClient` through the constructor or a setter method.

### DRY (Don't Repeat Yourself)

The DRY principle focuses on reducing duplication in code. Each piece of knowledge should have a single, unambiguous, and authoritative representation within a system.

**Before:**
```typescript
// Repeated code to validate emails in multiple functions
function saveCandidate(candidate: Candidate) {
    if (!candidate.email.includes('@')) {
        throw new Error('Invalid email');
    }
    // save logic
}

function updateCandidate(candidate: Candidate) {
    if (!candidate.email.includes('@')) {
        throw new Error('Invalid email');
    }
    // update logic
}
```

**After:**
```typescript
export class Candidate {
    validateEmail(): void {
        if (!this.email.includes('@')) {
            throw new Error('Invalid email');
        }
    }
    
    async save(): Promise<Candidate> {
        this.validateEmail();
        // save logic
    }
    
    async update(): Promise<Candidate> {
        this.validateEmail();
        // update logic
    }
}
```

**Explanation**: Email validation is centralized in a single `validateEmail` method, eliminating code duplication in the save and update functions.

**Observation**: The methods for saving entities like `Candidate`, `Education`, `WorkExperience`, and `Resume` contain repetitive logic for handling database operations.

**Recommendation**: Abstract common database operation logic into a reusable function or class.

## Coding Standards

### Naming Conventions

- **Variable Naming**: Use camelCase for variables and functions (e.g., `candidateId`, `findCandidateById`)
- **Class Naming**: Use PascalCase for classes and interfaces (e.g., `Candidate`, `CandidateRepository`)
- **Constants Naming**: Use UPPER_SNAKE_CASE for constants (e.g., `MAX_CANDIDATES_PER_PAGE`)
- **Type Naming**: Use PascalCase for types and interfaces (e.g., `CandidateData`, `ICandidateRepository`)
- **File Naming**: Use camelCase for file names (e.g., `candidateService.ts`, `candidateController.ts`)

**Examples:**

```typescript
// Good: All in English
export class CandidateRepository {
    async findById(candidateId: number): Promise<Candidate | null> {
        // Find candidate by ID in the database
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId }
        });
        return candidate ? new Candidate(candidate) : null;
    }
}

// Avoid: Non-English comments or names
export class RepositorioCandidato {
    async buscarPorId(idCandidato: number): Promise<Candidato | null> {
        // Buscar candidato por ID en la base de datos
        const candidato = await this.prisma.candidate.findUnique({
            where: { id: idCandidato }
        });
        return candidato ? new Candidato(candidato) : null;
    }
}
```

**Error Messages and Logs:**

```typescript
// Good: English error messages
throw new NotFoundError('Candidate not found with the provided ID');
logger.error('Failed to create candidate', { error: error.message });

// Avoid: Non-English messages
throw new NotFoundError('Candidato no encontrado con el ID proporcionado');
logger.error('Error al crear candidato', { error: error.message });
```

### TypeScript Usage

- **Strict Mode**: Always enable strict mode in `tsconfig.json`
- **Type Definitions**: Use explicit types for function parameters and return values
- **Interfaces**: Define interfaces for complex data structures
- **Avoid `any`**: Use `unknown` or specific types instead of `any` when possible

```typescript
// Good: Explicit types
async function findCandidateById(id: number): Promise<Candidate | null> {
    // implementation
}

// Avoid: Using any
function processData(data: any): any {
    // implementation
}
```

### Error Handling

- **Custom Error Classes**: Create domain-specific error classes
- **Error Middleware**: Use global error middleware for consistent error responses
- **Error Messages**: Provide descriptive error messages for debugging

```typescript
export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

// In controller
try {
    const candidate = await candidateService.findById(id);
    if (!candidate) {
        throw new NotFoundError('Candidate not found');
    }
    res.json(candidate);
} catch (error) {
    next(error);
}
```

### Validation Patterns

- **Input Validation**: Validate all inputs at the application layer
- **Use Validator Module**: Centralize validation logic in `src/application/validator.ts`
- **Validate Before Processing**: Always validate before executing business logic

```typescript
import { validateCandidateData } from '../application/validator';

export async function addCandidate(req: Request, res: Response, next: NextFunction) {
    try {
        const validatedData = validateCandidateData(req.body);
        const candidate = await candidateService.create(validatedData);
        res.status(201).json(candidate);
    } catch (error) {
        next(error);
    }
}
```

### Logging Standards

- **Use Logger Class**: Use the centralized logger from `src/infrastructure/logger.ts`
- **Log Levels**: Use appropriate log levels (info, error, warn, debug)
- **Structured Logging**: Include relevant context in log messages

```typescript
import { Logger } from '../infrastructure/logger';

const logger = new Logger();

logger.info('Candidate created', { candidateId: candidate.id });
logger.error('Failed to create candidate', { error: error.message });
```

## API Design Standards

### REST Endpoints

- **RESTful Naming**: Use RESTful conventions for endpoint naming
- **HTTP Methods**: Use appropriate HTTP methods (GET, POST, PUT, DELETE, PATCH)
- **Resource-Based URLs**: URLs should represent resources, not actions

```typescript
GET    /candidates          // List candidates
GET    /candidates/:id      // Get candidate by ID
POST   /candidates          // Create new candidate
PUT    /candidates/:id      // Update candidate
DELETE /candidates/:id      // Delete candidate
```

### Request/Response Patterns

- **JSON Format**: Use JSON for request and response bodies
- **Consistent Structure**: Maintain consistent response structure across all endpoints
- **Status Codes**: Use appropriate HTTP status codes

```typescript
// Success response
{
    "success": true,
    "data": { ... },
    "message": "Operation completed successfully"
}

// Error response
{
    "success": false,
    "error": {
        "message": "Error description",
        "code": "ERROR_CODE"
    }
}
```

### Error Response Format

- **Consistent Format**: All errors should follow the same response structure
- **Error Codes**: Use meaningful error codes for different error types
- **HTTP Status Codes**: Map errors to appropriate HTTP status codes

```typescript
// 400 Bad Request
{
    "success": false,
    "error": {
        "message": "Validation failed",
        "code": "VALIDATION_ERROR",
        "details": [ ... ]
    }
}

// 404 Not Found
{
    "success": false,
    "error": {
        "message": "Resource not found",
        "code": "NOT_FOUND"
    }
}
```

### CORS Configuration

- **Enable CORS**: Configure CORS to allow frontend origin
- **Secure Configuration**: Only allow specific origins in production
- **Credentials**: Configure credentials handling appropriately

```typescript
import cors from 'cors';

const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
};

app.use(cors(corsOptions));
```

## Database Patterns

### Prisma Schema

- **Single Source of Truth**: `prisma/schema.prisma` is the single source of truth for database structure
- **Relationships**: Define relationships using Prisma relations
- **Naming Conventions**: Use consistent naming conventions (camelCase for fields, PascalCase for models)

### Migrations

- **Version Control**: All database changes must be version-controlled through migrations
- **Migration Naming**: Use descriptive names for migrations
- **Review Migrations**: Review migration files before applying

```bash
# Create migration
npx prisma migrate dev --name descriptive_migration_name

# Apply migrations in production
npx prisma migrate deploy
```

### Repository Pattern

- **Repository Interfaces**: Define repository interfaces in the domain layer
- **Prisma Implementation**: Implement repositories using Prisma in the infrastructure layer
- **Dependency Injection**: Inject Prisma client into repositories

```typescript
// Domain layer interface
export interface ICandidateRepository {
    findById(id: number): Promise<Candidate | null>;
    save(candidate: Candidate): Promise<Candidate>;
}

// Infrastructure layer implementation
export class CandidateRepository implements ICandidateRepository {
    constructor(private prisma: PrismaClient) {}
    
    async findById(id: number): Promise<Candidate | null> {
        const data = await this.prisma.candidate.findUnique({ where: { id } });
        return data ? new Candidate(data) : null;
    }
}
```

## Testing Standards

The project has strict requirements for code quality and maintainability. These are the unit testing standards and best practices that must be applied. 

### Test File Structure
- Use descriptive test file names: `[componentName].test.ts`
- Place test files alongside the source code they test
- Use Jest as the testing framework with TypeScript support
- Maintain 90% coverage threshold for branches, functions, lines, and statements


### Test Organization Pattern
Template:
```typescript
describe('[ComponentName] - [methodName]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('should_[expected_behavior]_when_[condition]', () => {
    it('should [specific test case]', async () => {
      // Arrange
      // Act  
      // Assert
    });
  });
});
```

Real example:
```typescript
describe('CandidateService - findById', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return candidate when found', async () => {
        // Arrange
        const candidateId = 1;
        const mockCandidate = new Candidate({ id: 1, firstName: 'John' });
        (CandidateRepository.findById as jest.Mock).mockResolvedValue(mockCandidate);

        // Act
        const result = await candidateService.findById(candidateId);

        // Assert
        expect(result).toEqual(mockCandidate);
        expect(CandidateRepository.findById).toHaveBeenCalledWith(candidateId);
    });
});
```



### Test Case Naming Convention
- Use descriptive, behavior-driven naming: `should_[expected_behavior]_when_[condition]`
- Group related test cases under descriptive `describe` blocks
- Use snake_case for describe blocks and camelCase for individual tests

### Test Structure (AAA Pattern)
Always follow the Arrange-Act-Assert pattern:
```typescript
it('should update candidate stage successfully when valid data provided', async () => {
  // Arrange - Set up test data and mocks
  const candidateId = 1;
  const applicationId = 1;
  const newInterviewStep = 2;
  
  // Act - Execute the function under test
  const result = await updateCandidateStage(candidateId, applicationId, newInterviewStep);
  
  // Assert - Verify the expected behavior
  expect(result).toEqual(expectedResult);
});
```

Assertion pattern:
- Use specific matchers: `toHaveBeenCalledWith()`, `toHaveBeenCalledTimes()`
- Verify both successful operations and error conditions
- Check that mocks were called with correct parameters
- Assert on return values and side effects








### Mocking Standards

- Mock all external dependencies (models, services, database clients)
- Mock repository layers in service tests
- Mock service layers in controller tests
- Use `jest.mock()` at the top of test files for module-level mocking
- Create mock instances with realistic data structures
- Clear all mocks in `beforeEach()` to ensure test isolation


### Test Coverage Requirements

- **Comprehensive test coverage**: Include these test categories for each function:
1. **Happy Path Tests**: Valid inputs producing expected outputs
2. **Error Handling Tests**: Invalid inputs, missing data, database errors
3. **Edge Cases**: Boundary values, null/undefined inputs, empty data
4. **Validation Tests**: Input validation, business rule enforcement
5. **Integration Points**: External service calls, database operations

- **Threshold**: 90% for branches, functions, lines, and statements
- **Coverage Reports**: Generate coverage reports with `npm run test:coverage`
- **Coverage Files**: Coverage reports in `coverage/` directory adding the date, like YYYYMMDD-backend-coverage.md


### Error Testing
- Test both expected errors and unexpected errors
- Verify error messages are descriptive and helpful
- Test error propagation through service layers
- Ensure proper HTTP status codes in controller tests

### Controller Testing Specifics
- Mock the service layer completely
- Test HTTP request/response handling
- Verify parameter parsing and validation
- Test error response formatting
- Use realistic Express Request/Response mocks

### Service Testing Specifics
- Mock domain models and repositories
- Test business logic in isolation
- Verify data transformation and validation
- Test error handling and edge cases
- Mock external dependencies (Prisma, validators)

### Database Testing
- Mock Prisma client and all database operations
- Test both successful and failed database operations
- Verify correct database queries and parameters
- Test transaction handling and rollback scenarios

### Async Testing
- Always use `async/await` for asynchronous operations
- Use `Promise.allSettled()` for testing concurrent operations
- Properly handle promise rejections in tests
- Test timeout scenarios where applicable

### Test Data Management
- Use factory functions for creating test data
- Keep test data consistent and realistic
- Avoid hardcoded values in multiple places
- Use meaningful test data that reflects real-world scenarios

### Integration Testing

- **Controller Testing**: Test HTTP request/response handling
- **Database Testing**: Test repository implementations with database
- **End-to-End Flow**: Test complete request flows


### Code Quality Standards

#### TypeScript Usage
- Use strict typing for all test parameters and return values
- Define proper interfaces for mock data
- Use type assertions sparingly and with proper justification
- Leverage TypeScript's type system for better test reliability

#### Documentation
- Write clear, descriptive test names that explain the scenario
- Add comments for complex test setups
- Document any special test conditions or edge cases
- Keep test code as readable as production code

#### Performance Considerations
- Keep tests fast and focused
- Avoid unnecessary async operations in tests
- Use appropriate mock strategies to avoid real I/O
- Group related tests to minimize setup/teardown overhead

### Integration with Development Workflow
- Run tests before every commit
- Ensure all tests pass before merging
- Use test-driven development when appropriate
- Update tests when modifying existing functionality

### Common Anti-Patterns to Avoid
- Don't test implementation details, test behavior
- Don't create overly complex test setups
- Don't ignore failing tests or skip error scenarios
- Don't use real database connections in unit tests
- Don't create tests that depend on external services
- Don't write tests that are too tightly coupled to implementation

### Example Test Structure



## Performance Best Practices

### Database Query Optimization

- **Select Specific Fields**: Only select fields that are needed
- **Use Indexes**: Ensure proper database indexes for frequently queried fields
- **Avoid N+1 Queries**: Use Prisma's `include` to fetch related data efficiently

```typescript
// Good: Fetch related data efficiently
const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
        educations: true,
        workExperiences: true
    }
});

// Avoid: N+1 queries
const candidate = await prisma.candidate.findUnique({ where: { id } });
const educations = await prisma.education.findMany({ where: { candidateId: id } });
```

### Async/Await Patterns

- **Always Use Async/Await**: Use async/await instead of promises chains
- **Error Handling**: Properly handle errors in async operations
- **Parallel Operations**: Use `Promise.all()` for parallel operations when appropriate

```typescript
// Good: Parallel operations
const [candidates, positions] = await Promise.all([
    candidateService.findAll(),
    positionService.findAll()
]);
```

### Error Handling Performance

- **Early Returns**: Return early to avoid unnecessary processing
- **Error Propagation**: Let errors propagate naturally through the call stack
- **Avoid Over-Wrapping**: Don't wrap errors unnecessarily

## Security Best Practices

### Input Validation

- **Validate All Inputs**: Validate all user inputs before processing
- **Sanitize Data**: Sanitize data to prevent injection attacks
- **Type Checking**: Use TypeScript and validation to ensure type safety

### Environment Variables

- **Never Commit Secrets**: Never commit `.env` files or secrets to version control
- **Use Environment Variables**: Use environment variables for configuration
- **Validate Environment**: Validate required environment variables at startup

```typescript
// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'PORT'];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
    }
});
```

### Dependency Injection

- **Inject Prisma Client**: Inject Prisma client via Express middleware
- **Avoid Global State**: Avoid global state for database connections
- **Testability**: Use dependency injection to improve testability

```typescript
// Middleware to inject Prisma client
app.use((req: Request, res: Response, next: NextFunction) => {
    req.prisma = prisma;
    next();
});

// Use in controllers
export async function getCandidate(req: Request, res: Response) {
    const candidate = await req.prisma.candidate.findUnique({
        where: { id: req.params.id }
    });
    res.json(candidate);
}
```

## Development Workflow

### Git Workflow

- **Feature Branches**: Develop features in separate branches, adding descriptive suffix "-backend" to allow working in parallel and avoid conflicts or collisions
- **Descriptive Commits**: Write descriptive commit messages in English
- **Code Review**: Code review before merging
- **Small Branches**: Keep branches small and focused

### Development Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Build for production
npm test             # Run tests
npm run test:coverage # Run tests with coverage
npm run prisma:generate  # Generate Prisma client
npx prisma migrate dev   # Create and apply migration
npx prisma db seed       # Seed database
```

### Code Quality

- **ESLint Validation**: Run ESLint before commits
- **TypeScript Compilation**: Ensure TypeScript compiles without errors
- **All Tests Passing**: Ensure all tests pass before deployment
- **Code Review**: Review code for adherence to standards

## Serverless Deployment

### AWS Lambda Configuration

- **Lambda Handler**: Entry point is `src/lambda.ts`
- **Serverless HTTP**: Use `serverless-http` to wrap Express app
- **Environment Variables**: Configure environment variables in `serverless.yml`

### Serverless Framework

- **Configuration File**: `serverless.yml` defines Lambda configuration
- **Build Command**: Use `npm run build:lambda` for Lambda builds
- **Deployment**: Deploy using Serverless Framework CLI

```typescript
// lambda.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import serverless from 'serverless-http';
import { app } from './index';

const serverlessHandler = serverless(app);

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  context.callbackWaitsForEmptyEventLoop = false;
  return await serverlessHandler(event, context) as APIGatewayProxyResult;
};
```

This document serves as the foundation for maintaining code quality and consistency across the LTI backend application. All team members should follow these practices to ensure a maintainable, scalable, and testable codebase.
