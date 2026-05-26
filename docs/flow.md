# Data Flow Diagram

```mermaid
%%{init: {'theme': 'dark', 'layout': 'elk'}}%%
flowchart TD
    %% Nodes
    Client["Client App\n(Socket.IO client)"]
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
    EventBus["EventEmitter\n(internal.price.update)"]
    RealtimeGW["RealtimeGateway\n/real-time namespace"]
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
        RefreshService -->|"emits event"| EventBus
        EventBus -->|"catches via @OnEvent"| RealtimeGW
        RealtimeGW -->|"broadcasts to rooms"| Client
    end

    %% Flow 3: Client Subscription
    subgraph Client_Subscription ["Client Subscription"]
        Client -->|"subscribe:{topic}"| RealtimeGW
        Client -->|"unsubscribe:{topic}"| RealtimeGW
    end

    %% Flow 4: Order Execution
    subgraph Order_Execution ["Order Execution (10s)"]
        OrderService -->|"listQuotes()"| StockDB
        OrderService -->|"fetch pending"| OrdersDB
        OrderService -->|"match & execute"| OrdersDB
    end

    %% Flow 5: REST API
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
    classDef eventbus fill:#533483,color:#00d9ff,stroke:#00d9ff

    class StockDB,SnapshotsDB,OrdersDB,Cache db
    class Controller,RealtimeGW api
    class SeedService,Scheduler,RefreshService,Writer,MarketService,OrderService,Provider service
    class EODHD_API external
    class Client client
    class EventBus eventbus
```

## Flow Summary

| Flow | Trigger | What happens |
|------|---------|-------------|
| **Startup** | Server starts | Seeds stock records from provider's `getSeedData()` |
| **Scheduled Refresh** | Cron (EODHD: 6:30 PM weekdays) | Fetches quotes from provider → persists to DB + snapshots → emits `internal.price.update` event |
| **Client Subscription** | Client WebSocket message | Client subscribes/unsubscribes to stock rooms (e.g. `stock:AAPL`) |
| **Real-time Broadcast** | Internal event `internal.price.update` | `RealtimeGateway` catches the event → broadcasts `price_update` to subscribed room members |
| **Order Execution** | Every 10 seconds | Reads latest prices from DB → matches pending limit orders → executes |
| **REST API** | Client request | Reads from DB → returns quotes |

## Key Design Rules

### Market Data Provider
The `MarketDataProvider` interface is the **single extension point**. Adding a new provider requires:
1. Implement the interface
2. Register in `ProviderFactory`
3. Set `MARKET_PROVIDER` env var

**Zero service changes needed.**

### Real-time Gateway (The Megaphone Rule)
The `RealtimeGateway` MUST NOT contain cron jobs, external API calls, or business logic.
It receives data EXCLUSIVELY by listening to internal server events via `@nestjs/event-emitter`.

### Adding new real-time event types
1. Emit the event from the domain service: `this.eventEmitter.emit('internal.your.event', payload)`
2. Add an `@OnEvent('internal.your.event')` handler in `RealtimeGateway`
3. Define the client-facing event name and room targeting
