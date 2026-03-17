# 02 - Arquitectura del Sistema

## Visión General de la Arquitectura

Mattermost sigue una **arquitectura de capas (Layered Architecture)** con patrones de diseño bien definidos. Esta sección describe la estructura arquitectónica completa del sistema.

---

## Arquitectura de Capas del Servidor

```mermaid
graph TB
    subgraph Cliente["Capa de Cliente"]
        WebApp["WebApp React"]
        Mobile["Apps Móviles"]
        Desktop["Desktop App"]
        API_Client["Clientes API"]
    end

    subgraph Transporte["Capa de Transporte"]
        HTTP["HTTP Router<br/>Gorilla Mux"]
        WS["WebSocket Hub"]
        Middleware["Middleware<br/>Auth, CORS, Rate Limit"]
    end

    subgraph Aplicacion["Capa de Aplicación"]
        API_Handlers["API Handlers<br/>channels/api4/"]
        App_Layer["App Layer<br/>channels/app/"]
        Business_Logic["Business Logic<br/>Workflows"]
    end

    subgraph Datos["Capa de Datos"]
        Store["Store Layer<br/>Interfaces"]
        SQLStore["SQL Store<br/>Implementación"]
        CacheLayer["Cache Layer<br/>Local/Memoria"]
    end

    subgraph Persistencia["Capa de Persistencia"]
        DB[("Base de Datos<br/>MySQL/PostgreSQL")]
        FileStore[("File Store<br/>MinIO/S3/Local")]
        Search[("Search Engine<br/>Elasticsearch")]
    end

    Cliente -->|HTTP/WebSocket| Transporte
    Transporte -->|Enruta| API_Handlers
    API_Handlers -->|Llama| App_Layer
    App_Layer -->|Ejecuta| Business_Logic
    Business_Logic -->|Persiste| Store
    Store -->|Abstracto| SQLStore
    SQLStore -->|Cache| CacheLayer
    SQLStore -->|SQL| DB
    App_Layer -->|Archivos| FileStore
    App_Layer -->|Indexa| Search
```

---

## Flujo de una Petición HTTP

### Diagrama de Secuencia - Request Lifecycle

```mermaid
sequenceDiagram
    participant Client as Cliente
    participant Router as Gorilla Mux
    participant Middleware as Middleware Stack
    participant Handler as API Handler
    participant App as App Layer
    participant Store as Store Layer
    participant DB as Base de Datos

    Client->>Router: HTTP Request
    Router->>Middleware: Aplicar Middleware
    
    Note over Middleware: Autenticación,<br/>Rate Limiting,<br/>CORS, etc.
    
    Middleware->>Handler: Request validado
    Handler->>Handler: Parsear request body
    Handler->>App: Llamar lógica de negocio
    
    App->>App: Validar permisos
    App->>App: Ejecutar reglas de negocio
    
    alt Requiere acceso a datos
        App->>Store: Consultar/Modificar datos
        Store->>Store: Aplicar caché si aplica
        Store->>DB: Ejecutar query SQL
        DB-->>Store: Resultados
        Store-->>App: Datos/Error
    end
    
    App->>App: Procesar resultados
    App-->>Handler: Respuesta
    Handler->>Handler: Serializar JSON
    Handler-->>Middleware: Response
    Middleware-->>Router: Response
    Router-->>Client: HTTP Response
```

### Pasos Detallados

| Paso | Componente | Descripción |
|------|------------|-------------|
| 1 | **Router** ([`api4/api.go`](server/channels/api4/api.go)) | El router Gorilla Mux recibe la petición y la enruta al handler correspondiente |
| 2 | **Middleware** | Se aplican capas de: autenticación, CORS, rate limiting, CSRF protection |
| 3 | **Handler** ([`api4/*.go`](server/channels/api4/)) | Parsea el request, valida parámetros, llama a la capa App |
| 4 | **App Layer** ([`app/`](server/channels/app/)) | Contiene la lógica de negocio, orquesta llamadas al store |
| 5 | **Store Layer** ([`store/`](server/channels/store/)) | Abstrae el acceso a datos, implementa caché y métricas |
| 6 | **Base de Datos** | Ejecuta queries SQL contra MySQL o PostgreSQL |

---

## Patrones de Diseño Utilizados

### 1. Repository Pattern (Store Layer)

```mermaid
classDiagram
    class Store {
        <<interface>>
        +User() UserStore
        +Channel() ChannelStore
        +Post() PostStore
        +Team() TeamStore
        ...
    }
    
    class UserStore {
        <<interface>>
        +Save(user *User) (*User, error)
        +Get(id string) (*User, error)
        +Update(user *User) (*User, error)
        ...
    }
    
    class SqlUserStore {
        +Save(user *User) (*User, error)
        +Get(id string) (*User, error)
        +Update(user *User) (*User, error)
    }
    
    class CacheUserStore {
        -userStore UserStore
        +Save(user *User) (*User, error)
        +Get(id string) (*User, error)
        ...
    }
    
    Store --> UserStore
    UserStore <|-- SqlUserStore
    UserStore <|-- CacheUserStore
    CacheUserStore o-- UserStore
```

**Ubicación**: [`server/channels/store/store.go`](server/channels/store/store.go)

### 2. Layered Architecture con Decoradores

El Store implementa múltiples capas generadas automáticamente:

```mermaid
graph LR
    App["App Layer"] -->|Llama| Store
    
    subgraph StoreLayers["Capas del Store"]
        Timer["Timer Layer<br/>Métricas de tiempo"]
        OpenTracing["OpenTracing Layer<br/>Distributed tracing"]
        Cache["Cache Layer<br/>Caché local"]
        Retry["Retry Layer<br/>Reintentos"]
        SQL["SQL Store<br/>Implementación base"]
    end
    
    Store --> Timer
    Timer --> OpenTracing
    OpenTracing --> Cache
    Cache --> Retry
    Retry --> SQL
```

**Generación de capas**: [`server/channels/store/layer_generators/`](server/channels/store/layer_generators/)

### 3. Dependency Injection

Los servicios se inyectan a través de la estructura `App`:

```go
// Simplificación del patrón
type App struct {
    store        store.Store
    config       *model.Config
    cluster      einterfaces.ClusterInterface
    searchEngine *searchengine.Broker
    ...
}
```

### 4. Observer Pattern (WebSocket Events)

```mermaid
sequenceDiagram
    participant App as App Layer
    participant Hub as WebSocket Hub
    participant Conn1 as Conexión Usuario 1
    participant Conn2 as Conexión Usuario 2
    participant Conn3 as Conexión Usuario 3

    App->>Hub: PublishEvent(event)
    Note over Hub: Determinar suscriptores
    
    Hub->>Conn1: Enviar evento
    Hub->>Conn2: Enviar evento
    Hub->>Conn3: Enviar evento
```

---

## Arquitectura WebSocket para Tiempo Real

### Componentes del Sistema WebSocket

```mermaid
graph TB
    subgraph Clientes["Clientes Conectados"]
        C1["Usuario A<br/>Navegador 1"]
        C2["Usuario A<br/>Móvil"]
        C3["Usuario B<br/>Desktop"]
        C4["Usuario C<br/>Navegador"]
    end

    subgraph Servidor["Servidor Mattermost"]
        Hub["WebSocket Hub<br/>Central de mensajes"]
        
        subgraph Connections["Gestión de Conexiones"]
            WS1["WebConn 1"]
            WS2["WebConn 2"]
            WS3["WebConn 3"]
            WS4["WebConn 4"]
        end
        
        subgraph Channels["Canales de Broadcast"]
            BC1["Canal Usuario A"]
            BC2["Canal Usuario B"]
            BC3["Canal Canal-X"]
        end
    end

    C1 -->|WS| WS1
    C2 -->|WS| WS2
    C3 -->|WS| WS3
    C4 -->|WS| WS4
    
    WS1 -->|Registrado en| BC1
    WS2 -->|Registrado en| BC1
    WS3 -->|Registrado en| BC2
    WS3 -->|Registrado en| BC3
    WS4 -->|Registrado en| BC3
    
    Hub -->|Administra| Connections
    Hub -->|Broadcast| Channels
```

### Tipos de Eventos WebSocket

| Categoría | Eventos | Descripción |
|-----------|---------|-------------|
| **Mensajes** | `posted`, `post_edited`, `post_deleted` | Actividad de posts |
| **Canales** | `channel_created`, `channel_deleted`, `user_added` | Cambios en canales |
| **Usuarios** | `status_change`, `typing`, `user_updated` | Actividad de usuarios |
| **Equipos** | `leave_team`, `update_team` | Cambios en equipos |
| **Sistema** | `config_changed`, `plugin_enabled` | Eventos del sistema |

**Implementación**: [`server/channels/app/web_hub.go`](server/channels/app/web_hub.go)

---

## Arquitectura de Plugins

### Modelo de Plugins

```mermaid
graph TB
    subgraph Mattermost["Servidor Mattermost"]
        subgraph PluginSystem["Sistema de Plugins"]
            Supervisor["Plugin Supervisor"]
            RPC["RPC Layer"]
            Hooks["Plugin Hooks"]
        end
        
        Core["Core Mattermost"]
    end

    subgraph Plugins["Procesos de Plugins"]
        P1["Plugin A<br/>Go/HashiCorp go-plugin"]
        P2["Plugin B<br/>Go/HashiCorp go-plugin"]
        P3["Webapp Plugin<br/>JavaScript"]
    end

    Core -->|Hooks| Hooks
    Hooks -->|RPC| RPC
    RPC -->|IPC| P1
    RPC -->|IPC| P2
    
    Core -->|Registra| P3
    P3 -->|Componentes| Webapp["Webapp React"]
```

### API de Plugins

Los plugins pueden interactuar con Mattermost a través de:

| API | Descripción |
|-----|-------------|
| **Hooks** | Interceptar eventos del ciclo de vida |
| **API** | Llamar a funciones del servidor |
| **Webapp** | Extender la interfaz de usuario |

**Documentación**: [`server/public/plugin/`](server/public/plugin/)

---

## Arquitectura Enterprise

### Separación de Código

```mermaid
graph TB
    subgraph OpenSource["Código Open Source"]
        Core["Mattermost Core<br/>repo: mattermost"]
    end

    subgraph Enterprise["Código Enterprise"]
        Ent["Enterprise Features<br/>repo: enterprise"]
    end

    Core -->|Interfaces| EInterfaces
    Ent -->|Implementa| EInterfaces
    
    subgraph EInterfaces["Interfaces Enterprise"]
        Int1["LdapInterface"]
        Int2["SamlInterface"]
        Int3["ComplianceInterface"]
        Int4["ElasticsearchInterface"]
    end
```

Las funcionalidades Enterprise se activan mediante **build tags**:

```go
//go:build enterprise
```

**Ubicación de interfaces**: [`server/einterfaces/`](server/einterfaces/)

---

## Arquitectura del Frontend (Webapp)

### Arquitectura Redux

```mermaid
graph LR
    subgraph React["Componentes React"]
        UI1["Componentes UI"]
        UI2["Componentes de Páginas"]
    end

    subgraph Redux["Store Redux"]
        Actions["Actions<br/>Acciones"]
        Reducers["Reducers<br/>Actualizan estado"]
        Store["Store<br/>Estado global"]
        Selectors["Selectors<br/>Obtienen datos"]
    end

    subgraph API["Capa de API"]
        Client["Client4<br/>API Client"]
    end

    subgraph Server["Servidor"]
        REST["REST API"]
    end

    UI1 -->|Dispatch| Actions
    UI2 -->|Dispatch| Actions
    Actions -->|Async| Client
    Client -->|HTTP| REST
    REST -->|Response| Actions
    Actions -->|Reducer| Reducers
    Reducers -->|Actualiza| Store
    Store -->|Subscribe| UI1
    Store -->|Subscribe| UI2
    Selectors -->|Lee| Store
    UI1 -->|Usa| Selectors
```

### Estructura de Carpetas del Webapp

```
webapp/channels/src/
├── actions/           # Redux actions (thunks)
│   ├── posts.ts      # Acciones de posts
│   ├── users.ts      # Acciones de usuarios
│   └── channels.ts   # Acciones de canales
├── components/        # Componentes React
│   ├── common/       # Componentes compartidos
│   ├── post_view/    # Vista de posts
│   └── sidebar/      # Barra lateral
├── reducers/          # Redux reducers
│   ├── entities/     # Entidades (users, posts, channels)
│   └── requests/     # Estado de requests
├── selectors/         # Selectores memoizados
│   ├── entities.ts   # Selectores de entidades
│   └── general.ts    # Selectores generales
├── stores/            # Configuración de stores
├── types/             # Tipos TypeScript
└── utils/             # Utilidades
```

---

## Comunicación entre Componentes

### Flujo de Datos en el Sistema

```mermaid
sequenceDiagram
    participant User as Usuario
    participant Webapp as Webapp React
    participant API as API Server
    participant App as App Layer
    participant WS as WebSocket Hub
    participant Other as Otros Clientes

    User->>Webapp: Escribe mensaje
    Webapp->>Webapp: Actualiza estado local (optimistic)
    Webapp->>API: POST /api/v4/posts
    API->>App: CreatePost
    App->>App: Validaciones
    App->>App: Guardar en BD
    App->>WS: Broadcast evento
    API-->>Webapp: Respuesta (201 Created)
    WS->>Webapp: Evento websocket (confirmación)
    WS->>Other: Broadcast a otros clientes
    Other->>Other: Actualizar UI
```

---

## Consideraciones de Escalabilidad

### Escalabilidad Horizontal

```mermaid
graph TB
    subgraph LB["Load Balancer"]
        Nginx["Nginx/HAProxy"]
    end

    subgraph Servers["Servidores Mattermost"]
        S1["Servidor 1"]
        S2["Servidor 2"]
        S3["Servidor 3"]
    end

    subgraph Shared["Servicios Compartidos"]
        DB[("Base de Datos<br/>Master + Réplicas")]
        Files[("Object Storage<br/>S3/MinIO")]
        Redis[("Redis<br/>Cluster Hub")]
        ES[("Elasticsearch<br/>Cluster")]
    end

    Clientes["Clientes"] -->|HTTP/WS| LB
    LB -->|Proxy| S1
    LB -->|Proxy| S2
    LB -->|Proxy| S3

    S1 -->|SQL| DB
    S2 -->|SQL| DB
    S3 -->|SQL| DB

    S1 -->|Pub/Sub| Redis
    S2 -->|Pub/Sub| Redis
    S3 -->|Pub/Sub| Redis

    S1 -->|Files| Files
    S1 -->|Index| ES
```

### Stateless Design

Los servidores Mattermost son **stateless**, lo que permite:
- Escalado horizontal sin configuración compleja
- Balanceo de carga round-robin
- Recuperación automática de fallos

La única excepción es el **WebSocket Hub**, que requiere:
- Sesiones "sticky" o
- Clustering con Redis (Enterprise)

---

## Resumen de Componentes Clave

| Componente | Ubicación | Responsabilidad |
|------------|-----------|-----------------|
| **API Handlers** | [`channels/api4/`](server/channels/api4/) | HTTP routing, validación, serialización |
| **App Layer** | [`channels/app/`](server/channels/app/) | Lógica de negocio, orquestación |
| **Store Layer** | [`channels/store/`](server/channels/store/) | Abstracción de datos, caché |
| **WebSocket Hub** | [`app/web_hub.go`](server/channels/app/web_hub.go) | Mensajería en tiempo real |
| **Jobs** | [`channels/jobs/`](server/channels/jobs/) | Procesamiento en background |
| **Platform** | [`platform/`](server/platform/) | Servicios compartidos |
| **Models** | [`public/model/`](server/public/model/) | Definición de entidades |

---

## Próximos Pasos

Para profundizar en componentes específicos:

1. **[Backend Go](03-Backend_Go.md)** - Detalles del servidor
2. **[Frontend React](04-Frontend_React.md)** - Arquitectura del cliente
3. **[Base de Datos](05-Base_de_Datos.md)** - Modelo de datos

---

*Documentación basada en el código fuente de Mattermost v8.x*
