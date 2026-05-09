# Data Flow Diagram

```mermaid
%%{init: {'theme': 'dark', 'layout': 'elk'}}%%
flowchart TD
    %% Nodes
    Client["Client App"]
    Controller["MarketController"]
    MarketService["MarketService"]
    SeedService["MarketSeedService"]
    Scheduler["MarketRefreshScheduler"]
    RefreshService["MarketRefreshService"]
    Provider["MarketDataProvider\n(Mock / EODHD)"]
    Writer["MarketUpdateWriterService"]
    StockDB[("Stocks Collection")]
    SnapshotsDB[("Price Snapshots")]
    Cache[("Cache / Redis")]
    WS["MarketGateway\nWebSocket"]
    OrderService["OrderExecutionService\n(10s tick)"]
    OrdersDB[("Orders Collection")]
    EODHD_API["EODHD External API"]

    %% Flow 1: Server Startup
    subgraph Startup
        SeedService -->|"getSeedData()"| Provider
        Provider -->|"seed records"| StockDB
    end

    %% Flow 2: Scheduled Refresh
    subgraph Scheduled_Refresh ["Scheduled Refresh (cron)"]
        Scheduler -->|"getRefreshSchedule()"| Provider
        Scheduler -->|"triggers"| RefreshService
        RefreshService -->|"getQuotes()"| Provider
        Provider -->|"cache check"| SnapshotsDB
        Provider -->|"fetch (EODHD only)"| EODHD_API
        EODHD_API -->|"response"| Provider
        Provider -->|"quotes"| RefreshService
        RefreshService -->|"persist"| Writer
        Writer -->|"update"| StockDB
        Writer -->|"save snapshot"| SnapshotsDB
        Writer -->|"cache"| Cache
        RefreshService -->|"emit"| WS
    end

    %% Flow 3: Order Execution
    subgraph Order_Execution ["Order Execution (10s)"]
        OrderService -->|"listQuotes()"| StockDB
        OrderService -->|"fetch pending"| OrdersDB
        OrderService -->|"match & execute"| OrdersDB
    end

    %% Flow 4: REST API
    subgraph REST_API ["REST API"]
        Client -->|"GET /api/market/stocks"| Controller
        Controller -->|"listQuotes()"| MarketService
        MarketService -->|"query"| StockDB
        StockDB -->|"quotes"| MarketService
        MarketService -->|"response"| Controller
        Controller -->|"response"| Client
    end

    %% Styling
    classDef db fill:#1a1a2e,color:#e94560,stroke:#e94560
    classDef api fill:#16213e,color:#fff,stroke:#533483
    classDef service fill:#0f3460,color:#e94560,stroke:#e94560
    classDef external fill:#533483,color:#fff,stroke:#e94560
    classDef client fill:#1a1a2e,color:#00d9ff,stroke:#00d9ff

    class StockDB,SnapshotsDB,OrdersDB,Cache db
    class Controller,WS api
    class SeedService,Scheduler,RefreshService,Writer,MarketService,OrderService,Provider service
    class EODHD_API external
    class Client client
```

## Flow Summary

| Flow | Trigger | What happens |
|------|---------|-------------|
| **Startup** | Server starts | Seeds stock records from provider's `getSeedData()` |
| **Scheduled Refresh** | Cron (EODHD: 6:30 PM weekdays) | Fetches quotes from provider → persists to DB + snapshots → emits via WebSocket |
| **Order Execution** | Every 10 seconds | Reads latest prices from DB → matches pending limit orders → executes |
| **REST API** | Client request | Reads from DB → returns quotes |

## Key Design Rule

The `MarketDataProvider` interface is the **single extension point**. Adding a new provider requires:

1. Implement the interface
2. Register in `ProviderFactory`
3. Set `MARKET_PROVIDER` env var

**Zero service changes needed.**
