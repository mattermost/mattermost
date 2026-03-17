# 08 - Flujos de Negocio Principales

## Visión General

Esta sección describe los flujos de negocio más importantes de Mattermost, incluyendo diagramas de secuencia, estados y procesos clave.

---

## 1. Registro de Usuario

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    participant User as Usuario
    participant Webapp as Webapp
    participant API as API
    participant App as App Layer
    participant Store as Store
    participant Email as Servicio Email

    User->>Webapp: Completar formulario de registro
    Webapp->>Webapp: Validar datos del formulario
    Webapp->>API: POST /users
    
    API->>API: Validar campos requeridos
    API->>App: CreateUser(user)
    
    App->>App: Validar política de contraseña
    App->>App: Validar dominio permitido
    App->>Store: GetUserByEmail(email)
    Store-->>App: nil (no existe)
    
    App->>App: HashPassword(user.Password)
    App->>App: user.PreSave()
    
    App->>Store: SaveUser(user)
    Store->>DB: INSERT INTO Users
    Store-->>App: User creado
    
    alt Email verification requerido
        App->>Email: Enviar email de verificación
    end
    
    alt Auto-join a equipos por defecto
        App->>Store: AddUserToDefaultTeams
    end
    
    App-->>API: User creado
    API-->>Webapp: 201 Created + user
    Webapp->>Webapp: Login automático
    Webapp-->>User: Redirigir a página principal
```

### Estados del Usuario

```mermaid
stateDiagram-v2
    [*] --> Pending: Registro iniciado
    Pending --> Active: Email verificado
    Pending --> Active: Verificación deshabilitada
    Active --> Deactivated: Admin desactiva
    Active --> Deleted: Eliminación soft
    Deactivated --> Active: Admin reactiva
    Deleted --> [*]
```

---

## 2. Envío de Mensaje (Post)

### Diagrama de Secuencia Completo

```mermaid
sequenceDiagram
    participant Cliente as Cliente Web
    participant Redux as Redux Store
    participant API as API Server
    participant App as App Layer
    participant Notif as Notification Service
    participant WS as WebSocket Hub
    participant Search as Search Engine
    participant DB as Base de Datos
    participant Otros as Otros Clientes

    Cliente->>Cliente: Usuario escribe mensaje
    Cliente->>Redux: Dispatch createPost
    
    Note over Cliente,Redux: Optimistic UI Update
    
    Redux->>Redux: Agregar post a estado (pending)
    Cliente->>Cliente: Mostrar post inmediatamente
    
    Redux->>API: POST /posts
    
    API->>App: CreatePost(c, post)
    
    App->>App: Validar permisos (create_post)
    App->>App: Validar rate limiting
    App->>App: post.PreSave()
    
    alt Mensaje en hilo (reply)
        App->>App: Actualizar contador de respuestas
    end
    
    alt Con archivos adjuntos
        App->>App: Procesar file_ids
    end
    
    App->>App: Extraer menciones (@usuario)
    App->>App: Extraer hashtags (#tag)
    
    App->>DB: INSERT INTO Posts
    DB-->>App: Post guardado
    
    par Procesamiento asíncrono
        App->>Search: Indexar post
        App->>DB: Actualizar Threads si es reply
        App->>Notif: Enviar notificaciones
    end
    
    App->>WS: Broadcast evento "posted"
    WS->>Otros: Notificar a suscriptores del canal
    WS->>Cliente: Confirmación del post
    
    App-->>API: Post creado
    API-->>Redux: 201 Created
    
    Redux->>Redux: Actualizar post (confirmado)
    Redux->>Cliente: Re-render si necesario
```

### Ciclo de Vida de un Post

```mermaid
stateDiagram-v2
    [*] --> Draft: Escribiendo (borrador local)
    Draft --> Sending: Enviar
    Sending --> Posted: Éxito
    Sending --> Failed: Error
    Failed --> Sending: Reintentar
    Failed --> Draft: Editar
    Posted --> Edited: Editar
    Posted --> Deleted: Eliminar
    Edited --> Edited: Editar nuevamente
    Edited --> Deleted: Eliminar
    Deleted --> [*]
```

### Procesamiento de Menciones

```go
// Lógica simplificada
func (a *App) parseMentions(text string, channel *model.Channel) []string {
    mentions := []string{}
    
    // Extraer @username
    pattern := `@([a-z0-9_\-.]+)`
    re := regexp.MustCompile(pattern)
    matches := re.FindAllStringSubmatch(text, -1)
    
    for _, match := range matches {
        username := match[1]
        
        // Verificar si usuario existe en canal
        if user, _ := a.GetUserByUsername(username); user != nil {
            mentions = append(mentions, user.Id)
        }
    }
    
    // Menciones especiales: @channel, @here, @all
    if strings.Contains(text, "@channel") || strings.Contains(text, "@all") {
        // Notificar a todos los miembros del canal
    }
    
    if strings.Contains(text, "@here") {
        // Notificar solo a usuarios online
    }
    
    return mentions
}
```

---

## 3. Sistema de Notificaciones

### Arquitectura de Notificaciones

```mermaid
graph TB
    subgraph Event["Evento Disparador"]
        NewPost["Nuevo Post"]
        Mention["Mención"]
        DM["Mensaje Directo"]
    end

    subgraph Processor["Procesador"]
        Check1["¿Usuario tiene notificaciones habilitadas?"]
        Check2["¿Está online en otro dispositivo?"]
        Check3["¿Dentro del horario de notificaciones?"]
        Queue["Cola de notificaciones"]
    end

    subgraph Channels["Canales de Notificación"]
        WebSocket["WebSocket Push"]
        Email["Email"]
        Push["Push Notification<br/>FCM/APNs"]
        Desktop["Desktop Notification"]
    end

    Event --> Processor
    Check1 -->|Sí| Check2
    Check2 -->|Sí| Check3
    Check3 -->|Sí| Queue
    Queue --> Channels
```

### Flujo de Notificación por Email

```mermaid
sequenceDiagram
    participant App as App Layer
    participant Notif as Notification Service
    participant Queue as Email Batcher
    participant Worker as Email Worker
    participant SMTP as Servidor SMTP

    App->>Notif: NewPost with mentions
    Notif->>Notif: Verificar preferencias
    Notif->>Notif: Verificar status away/offline
    
    alt Email batching habilitado
        Notif->>Queue: Agregar a batch
        Note over Queue: Esperar intervalo o límite
        Queue->>Worker: Procesar batch
    else Email inmediato
        Notif->>Worker: Enviar inmediato
    end
    
    Worker->>Worker: Generar contenido HTML
    Worker->>Worker: Aplicar plantilla
    Worker->>SMTP: Enviar email
    SMTP-->>Worker: Confirmación
```

### Preferencias de Notificación

```json
{
    "notify_props": {
        "desktop": "mention",        // all, mention, none
        "desktop_sound": "true",     // true, false
        "email": "true",             // true, false
        "push": "mention",           // all, mention, none
        "push_status": "away",       // online, away, offline
        "comments": "any",           // never, root, any
        "mention_keys": "@usuario,usuario",
        "channel": "true",           // true, false
        "first_name": "false"        // true, false
    }
}
```

---

## 4. Creación de Canal

### Diagrama de Secuencia

```mermaid
sequenceDiagram
    participant User as Usuario
    participant UI as UI
    participant API as API
    participant App as App Layer
    participant Policy as Channel Policy
    participant Store as Store
    participant WS as WebSocket Hub

    User->>UI: Click "Crear Canal"
    UI->>UI: Mostrar modal de creación
    User->>UI: Ingresar nombre y tipo
    User->>UI: Click "Crear"
    
    UI->>API: POST /channels
    API->>App: CreateChannel(c, channel)
    
    App->>App: Validar permisos (create_public_channel/create_private_channel)
    App->>Policy: Verificar política de nombres
    
    alt Nombre no permitido
        Policy-->>App: Error
        App-->>API: 400 Bad Request
        API-->>UI: Mostrar error
    end
    
    App->>Store: GetChannelByName(teamId, name)
    Store-->>App: nil (no existe)
    
    App->>App: channel.PreSave()
    App->>App: Sanitizar nombre (URL-friendly)
    
    App->>Store: SaveChannel(channel)
    Store->>DB: INSERT INTO Channels
    Store-->>App: Canal creado
    
    App->>Store: AddChannelMember(channel.Id, creatorId)
    Store-->>App: Miembro agregado (admin)
    
    App->>Store: CreateInitialSidebarCategories
    
    alt Canal público
        App->>WS: Broadcast "channel_created"
        WS->>UI: Actualizar lista de canales
    end
    
    App-->>API: Canal creado
    API-->>UI: 201 Created
    UI->>UI: Navegar al nuevo canal
```

### Tipos de Canales y Creación

| Tipo | Permiso Requerido | Visibilidad |
|------|-------------------|-------------|
| **Público** | `create_public_channel` | Todos en el equipo |
| **Privado** | `create_private_channel` | Solo miembros invitados |
| **Directo** | Auto-creado | 2 usuarios específicos |
| **Grupal** | Auto-creado | 3-8 usuarios específicos |

---

## 5. Subida de Archivos

### Flujo de Subida

```mermaid
sequenceDiagram
    participant Cliente as Cliente
    participant API as API Server
    participant App as App Layer
    participant Filestore as File Backend
    participant DB as Base de Datos

    Cliente->>Cliente: Seleccionar archivo
    Cliente->>Cliente: Validar tamaño y tipo
    
    Cliente->>API: POST /files (multipart)
    API->>App: UploadFile(data, channelId, filename)
    
    App->>App: Validar extensión permitida
    App->>App: Validar tamaño máximo
    App->>App: Detectar mime type
    
    alt Es imagen
        App->>App: Generar miniaturas
        App->>App: Generar preview
    end
    
    App->>Filestore: WriteFile(data, path)
    Filestore-->>App: Éxito
    
    alt Es imagen
        App->>Filestore: WriteFile(thumbnail, thumbPath)
        App->>Filestore: WriteFile(preview, previewPath)
    end
    
    App->>DB: INSERT INTO FileInfo
    DB-->>App: FileInfo creado
    
    App-->>API: FileInfo
    API-->>Cliente: 201 Created + file info
    
    Cliente->>Cliente: Previsualizar archivo
```

### Almacenamiento de Archivos

```mermaid
graph TB
    subgraph Upload["Proceso de Upload"]
        File["Archivo Original"]
        Thumb["Thumbnail<br/>Si es imagen"]
        Preview["Preview<br/>Si es imagen"]
    end
    
    subgraph Storage["Backends de Almacenamiento"]
        Local["Sistema de Archivos Local"]
        S3["Amazon S3"]
        MinIO["MinIO<br/>S3-Compatible"]
    end
    
    subgraph DB["Base de Datos"]
        FileInfo["FileInfo Record<br/>ruta, tamaño, mime_type"]
    end
    
    File --> Storage
    Thumb --> Storage
    Preview --> Storage
    Storage --> DB
```

---

## 6. Búsqueda de Contenido

### Flujo de Búsqueda

```mermaid
sequenceDiagram
    participant User as Usuario
    participant UI as Search UI
    participant API as API
    participant App as App Layer
    participant Search as Search Engine
    participant DB as Base de Datos (fallback)

    User->>UI: Ingresar término de búsqueda
    User->>UI: Presionar Enter / Click Buscar
    
    UI->>API: GET /posts/search?q=termino&page=0
    API->>App: SearchPosts(c, params)
    
    App->>App: Parsear query de búsqueda
    
    alt Elasticsearch habilitado
        App->>Search: SearchPostsInIndex
        Search->>Search: Query en índice ES
        Search-->>App: Resultados + IDs
        App->>DB: Fetch posts completos
    else Bleve (local)
        App->>Search: Search en Bleve
        Search-->>App: Resultados
    else Solo base de datos
        App->>DB: SQL LIKE search
    end
    
    App->>App: Filtrar por permisos de canal
    App->>App: Deduplicar resultados
    
    App-->>API: Lista de posts
    API-->>UI: Resultados paginados
    UI->>UI: Renderizar lista de posts
```

### Operadores de Búsqueda

| Operador | Ejemplo | Descripción |
|----------|---------|-------------|
| `from:` | `from:john` | Posts de usuario específico |
| `in:` | `in:desarrollo` | Posts en canal específico |
| `on:` | `on:2024-01-15` | Posts en fecha específica |
| `before:` | `before:2024-01-01` | Posts antes de fecha |
| `after:` | `after:2024-01-01` | Posts después de fecha |
| `""` | `"exact phrase"` | Búsqueda exacta |
| `*` | `proj*` | Comodín (wildcard) |

---

## 7. Sistema de Hilos (Threads)

### Flujo de Respuesta en Hilo

```mermaid
sequenceDiagram
    participant Cliente as Cliente
    participant API as API
    participant App as App Layer
    participant ThreadSvc as Thread Service
    participant Notif as Notification Service
    participant WS as WebSocket Hub

    Cliente->>API: POST /posts (con root_id)
    API->>App: CreatePost(c, post)
    
    App->>App: Validar post raíz existe
    App->>App: Validar permisos en canal
    
    App->>DB: INSERT INTO Posts
    
    App->>ThreadSvc: UpdateThreadForPost(post)
    
    ThreadSvc->>DB: UPDATE Threads SET ReplyCount = ReplyCount + 1
    ThreadSvc->>DB: UPDATE Threads SET LastReplyAt = now
    
    ThreadSvc->>DB: Actualizar ThreadMemberships
    Note over ThreadSvc: Marcar como unread para<br/>seguidores del hilo
    
    App->>Notif: Notificar participantes
    Notif->>Notif: Filtrar por preferencias
    
    App->>WS: Broadcast evento
    WS->>Cliente: Actualizar thread
    
    alt Usuario sigue el hilo
        WS->>Otros: Notificar nueva respuesta
    end
```

### Estados de Seguimiento de Hilo

```mermaid
stateDiagram-v2
    [*] --> Following: Crear respuesta
    [*] --> Following: Responder en hilo
    [*] --> NotFollowing: Ver hilo sin interactuar
    
    Following --> NotFollowing: Dejar de seguir
    NotFollowing --> Following: Seguir hilo
    
    Following --> Read: Leer todas las respuestas
    NotFollowing --> Read: Leer (sin notificaciones)
    
    Read --> Unread: Nueva respuesta
    Unread --> Read: Leer respuestas
```

---

## 8. Invitación de Usuarios

### Flujo de Invitación

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant App as Mattermost
    participant Email as Email Service
    participant Invitado as Usuario Invitado

    Admin->>App: Enviar invitaciones
    App->>App: Validar permisos (invite_user)
    App->>App: Validar límites de equipo
    
    loop Por cada email
        App->>App: Generar token de invitación
        App->>Email: Enviar email de invitación
        Email->>Invitado: 📧 Tienes una invitación
    end
    
    Invitado->>App: Click en link de invitación
    App->>App: Validar token
    
    alt Token válido
        App->>Invitado: Mostrar formulario de registro
        Invitado->>App: Completar registro
        App->>App: Crear usuario y unir a equipo
        App-->>Invitado: Redirigir al equipo
    else Token expirado
        App-->>Invitado: Solicitar nueva invitación
    end
```

---

## Resumen de Flujos

| Flujo | Complejidad | Componentes Principales |
|-------|-------------|-------------------------|
| **Registro** | Media | Users, Email, Teams |
| **Post** | Alta | Posts, WebSocket, Notifications, Search |
| **Notificaciones** | Alta | Users, Channels, Email, Push |
| **Canal** | Media | Channels, Permissions, WebSocket |
| **Archivos** | Media | FileInfo, FileBackend, Previews |
| **Búsqueda** | Alta | Search Engine, Posts, Permissions |
| **Hilos** | Alta | Posts, Threads, WebSocket |
| **Invitaciones** | Media | Tokens, Email, Users |

---

## Próximos Pasos

Para continuar:

1. **[Infraestructura y Despliegue](09-Infraestructura_y_Despliegue.md)** - Soporte para estos flujos
2. **[Sistema de Plugins](11-Sistema_de_Plugins.md)** - Extensión de flujos
3. **[Guía de Desarrollo](10-Guia_de_Desarrollo.md)** - Implementar nuevos flujos

---

*Documentación basada en Mattermost v8.x*
