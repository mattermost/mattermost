# 09 - Infraestructura y Despliegue

## Visión General

Mattermost está diseñado para desplegarse en diversos entornos, desde un solo servidor hasta arquitecturas altamente disponibles con múltiples nodos. Esta sección cubre la infraestructura, servicios de soporte y opciones de despliegue.

---

## Arquitectura de Despliegue

### Despliegue Básico (Desarrollo)

```mermaid
graph TB
    subgraph DockerCompose["Docker Compose"]
        App["Mattermost Server
+ Webapp"]
        DB["(MySQL/PostgreSQL)"]
        MinIO["MinIO
(Object Storage)"]
    end

    Dev["Desarrollador"] -->|HTTP:8065| App
    App -->|SQL| DB
    App -->|S3 API| MinIO
```

### Despliegue de Producción

```mermaid
graph TB
    subgraph Infra["Infraestructura de Producción"]
        LB["Load Balancer
(Nginx/HAProxy)"]

        subgraph AppTier["Application Tier"]
            App1["Mattermost 1"]
            App2["Mattermost 2"]
            App3["Mattermost N"]
        end

        subgraph DataTier["Data Tier"]
            DB[("MySQL/PostgreSQL
Master + Réplicas")]
            Cache[("Redis
Cluster")]
            Search[("Elasticsearch
Cluster")]
        end

        Storage[("S3/MinIO
Object Storage")]
    end

    Users["Usuarios"] -->|HTTPS/WSS| LB
    LB -->|HTTP| App1
    LB -->|HTTP| App2
    LB -->|HTTP| App3

    App1 -->|SQL| DB
    App2 -->|SQL| DB
    App3 -->|SQL| DB

    App1 -->|Cache| Cache
    App2 -->|Cache| Cache
    App3 -->|Cache| Cache

    App1 -->|Index| Search
    App2 -->|Index| Search
    App3 -->|Index| Search

    App1 -->|Files| Storage
    App2 -->|Files| Storage
    App3 -->|Files| Storage
```

---

## Servicios de Soporte

### 1. Base de Datos

**Opciones Soportadas:**

| Base de Datos | Versión Mínima | Notas |
|---------------|----------------|-------|
| **MySQL** | 8.0 | Modo de autenticación: mysql_native_password |
| **PostgreSQL** | 13+ | Recomendado para grandes instalaciones |

**Configuración de Docker Compose:**

```yaml
# server/docker-compose.yaml
version: '3'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: mattermost
      MYSQL_USER: mmuser
      MYSQL_PASSWORD: mmpassword
    volumes:
      - mysql-data:/var/lib/mysql
    ports:
      - "3306:3306"

  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: mmuser
      POSTGRES_PASSWORD: mmpassword
      POSTGRES_DB: mattermost
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
```

**Configuración de Mattermost:**

```json
{
    "SqlSettings": {
        "DriverName": "mysql",
        "DataSource": "mmuser:mmpassword@tcp(mysql:3306)/mattermost?charset=utf8mb4",
        "MaxIdleConns": 20,
        "MaxOpenConns": 300,
        "ConnMaxLifetimeMilliseconds": 3600000,
        "ConnMaxIdleTimeMilliseconds": 300000
    }
}
```

### 2. Almacenamiento de Archivos

**Opciones:**

| Tipo | Configuración | Caso de Uso |
|------|---------------|-------------|
| **Local** | `DriverName: local` | Desarrollo, pequeñas instalaciones |
| **Amazon S3** | `DriverName: amazons3` | Producción en AWS |
| **MinIO** | `DriverName: amazons3` | On-premise, S3-compatible |

**Configuración MinIO:**

```yaml
# docker-compose.yaml
services:
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio-data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
```

**Configuración Mattermost:**

```json
{
    "FileSettings": {
        "DriverName": "amazons3",
        "AmazonS3AccessKeyId": "minioadmin",
        "AmazonS3SecretAccessKey": "minioadmin",
        "AmazonS3Bucket": "mattermost",
        "AmazonS3Endpoint": "minio:9000",
        "AmazonS3SSL": false,
        "AmazonS3SSE": false,
        "AmazonS3Trace": false
    }
}
```

### 3. Elasticsearch (Búsqueda)

```yaml
# docker-compose.yaml
services:
  elasticsearch:
    image: elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es-data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
```

**Configuración Mattermost:**

```json
{
    "ElasticsearchSettings": {
        "ConnectionUrl": "http://elasticsearch:9200",
        "Username": "",
        "Password": "",
        "EnableIndexing": true,
        "EnableSearching": true,
        "Sniff": false,
        "PostIndexReplicas": 1,
        "PostIndexShards": 1
    }
}
```

### 4. Redis (Enterprise)

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
```

---

## Configuración del Servidor

### Variables de Entorno

Mattermost soporta configuración mediante variables de entorno con el prefijo `MM_`:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MM_SERVICESETTINGS_LISTENADDRESS` | Puerto de escucha | `:8065` |
| `MM_SERVICESETTINGS_SITEURL` | URL pública | `https://mattermost.ejemplo.com` |
| `MM_SQLSETTINGS_DRIVERNAME` | Driver de BD | `mysql` |
| `MM_SQLSETTINGS_DATASOURCE` | Connection string | `mmuser:pass@tcp(db:3306)/mattermost` |
| `MM_FILESETTINGS_DIRECTORY` | Directorio de archivos | `/mattermost/data` |
| `MM_LOGSETTINGS_ENABLEFILE` | Logging a archivo | `true` |
| `MM_LOGSETTINGS_FILELOCATION` | Ubicación de logs | `/mattermost/logs` |

### Archivo de Configuración

Ubicación por defecto: `config/config.json`

```json
{
    "ServiceSettings": {
        "SiteURL": "https://mattermost.ejemplo.com",
        "ListenAddress": ":8065",
        "ConnectionSecurity": "TLS",
        "TLSCertFile": "/etc/mattermost/tls/cert.pem",
        "TLSKeyFile": "/etc/mattermost/tls/key.pem",
        "EnableInsecureOutgoingConnections": false,
        "AllowedUntrustedInternalConnections": "",
        "EnableMultifactorAuthentication": true,
        "EnforceMultifactorAuthentication": false,
        "EnableUserAccessTokens": true,
        "EnableOAuthServiceProvider": true
    },
    "TeamSettings": {
        "SiteName": "Mattermost",
        "MaxUsersPerTeam": 50000,
        "EnableUserCreation": true,
        "EnableOpenServer": false,
        "EnableUserDeactivation": true,
        "RestrictCreationToDomains": "ejemplo.com",
        "EnableCustomBrand": false
    },
    "PasswordSettings": {
        "MinimumLength": 10,
        "Lowercase": true,
        "Number": true,
        "Uppercase": true,
        "Symbol": true
    }
}
```

---

## Docker Compose Completo

```yaml
# docker-compose.yaml
version: '3'

services:
  mattermost:
    image: mattermost/mattermost-team-edition:latest
    ports:
      - "8065:8065"
    environment:
      - MM_SQLSETTINGS_DRIVERNAME=postgres
      - MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:mmpassword@postgres:5432/mattermost?sslmode=disable
      - MM_FILESETTINGS_DRIVERNAME=local
      - MM_FILESETTINGS_DIRECTORY=/mattermost/data
      - MM_SERVICESETTINGS_SITEURL=http://localhost:8065
    volumes:
      - mattermost-data:/mattermost/data
      - ./config:/mattermost/config
    depends_on:
      - postgres

  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: mmuser
      POSTGRES_PASSWORD: mmpassword
      POSTGRES_DB: mattermost
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio-data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  mattermost-data:
  postgres-data:
  minio-data:
```

---

## Alta Disponibilidad (Enterprise)

### Arquitectura HA

```mermaid
graph TB
    subgraph LoadBalancers["Load Balancers"]
        LB1["Nginx 1 (Activo)"]
        LB2["Nginx 2 (Standby)"]
        VIP["Virtual IP
(Keepalived)"]
    end

    subgraph Application["Application Cluster"]
        App1["Mattermost 1"]
        App2["Mattermost 2"]
        App3["Mattermost 3"]
    end

    subgraph Data["Data Layer"]
        DBMaster[("MySQL
Master")]
        DBSlave1[("MySQL
Slave 1")]
        DBSlave2[("MySQL
Slave 2")]

        Redis[("Redis
Sentinel")]

        ES[("Elasticsearch
Cluster")]
    end

    Users --> VIP
    VIP --> LB1
    VIP --> LB2

    LB1 --> App1
    LB1 --> App2
    LB1 --> App3

    App1 --> DBMaster
    App2 --> DBMaster
    App3 --> DBMaster

    DBMaster --> DBSlave1
    DBMaster --> DBSlave2

    App1 --> Redis
    App2 --> Redis
    App3 --> Redis

    App1 --> ES
    App2 --> ES
    App3 --> ES
```

### Clustering de WebSocket

Para HA, los WebSocket Hubs deben comunicarse entre sí:

```json
{
    "ClusterSettings": {
        "Enable": true,
        "ClusterName": "production",
        "OverrideHostname": "",
        "UseIpAddress": true,
        "UseExperimentalGossip": false,
        "ReadOnlyConfig": true,
        "GossipPort": 8074,
        "StreamingPort": 8075,
        "MaxIdleConns": 100,
        "MaxIdleConnsPerHost": 128
    }
}
```

---

## Escalabilidad

### Límites Recomendados

| Componente | Límite por Instancia | Notas |
|------------|----------------------|-------|
| **Usuarios concurrentes** | 10,000 - 50,000 | Depende de RAM/CPU |
| **Mensajes/segundo** | 500 - 2,000 | Optimización de BD requerida |
| **Archivos/día** | 100,000+ | S3/MinIO recomendado |
| **Canales por equipo** | 10,000+ | Índices apropiados |

### Estrategias de Escalado

**Vertical:**
- Aumentar RAM para caché
- CPU más rápida para procesamiento
- SSD para base de datos

**Horizontal:**
- Múltiples servidores Mattermost
- Réplicas de lectura en BD
- Clustering de Elasticsearch
- Redis para sesiones distribuidas

---

## Monitoreo y Logging

### Métricas

Mattermost expone métricas en formato Prometheus:

```yaml
# Prometheus config
crape_configs:
  - job_name: 'mattermost'
    static_configs:
      - targets: ['mattermost:8065']
    metrics_path: '/metrics'
```

**Métricas clave:**
- `mattermost_http_requests_total`
- `mattermost_db_connections_open`
- `mattermost_websocket_connections_active`
- `mattermost_post_create_count`

### Logging

```json
{
    "LogSettings": {
        "EnableConsole": true,
        "ConsoleLevel": "INFO",
        "ConsoleJson": true,
        "EnableFile": true,
        "FileLevel": "DEBUG",
        "FileJson": true,
        "FileLocation": "/var/log/mattermost/"
    }
}
```

---

## Próximos Pasos

Para continuar:

1. **[Guía de Desarrollo](10-Guia_de_Desarrollo.md)** - Configuración de entorno local
2. **[Sistema de Plugins](11-Sistema_de_Plugins.md)** - Extensión de funcionalidad
3. **[Glosario](12-Glosario_y_Referencias.md)** - Términos técnicos

---

*Documentación basada en Mattermost v8.x*
