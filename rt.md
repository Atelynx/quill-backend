
# Feature: Real-Time Market WebSocket Gateway (The Broadcaster)

## Summary

Implement a centralized, event-driven WebSocket Gateway using Socket.io. This module will act as the single source of truth for all real-time outbound communication to the frontend clients. It completely replaces the need for the frontend to make repetitive REST polling requests for volatile data (like market prices or currency rates).

## Core Responsibilities (Constraints)

* **The Megaphone Rule:** This module MUST NOT contain any Cron Jobs, external API calls, or business logic.
* **Event-Driven Intake:** It must receive data EXCLUSIVELY by listening to internal server events via `@nestjs/event-emitter` (e.g., listening to events fired by the `Exchange_Currency` or `Stock_Market` modules).

## Goals & Acceptance Criteria

1. **WebSocket Infrastructure:** Setup a NestJS `@WebSocketGateway` with proper CORS configuration to communicate with the Vite/React frontend.
2. **Room-Based Subscription System:** Implement a pub/sub mechanism. Clients should be able to emit a `subscribe` event for specific topics (e.g., `ROOM:AAPL` or `ROOM:USDCLP`). The Gateway must ONLY broadcast data to users inside the relevant rooms to optimize network bandwidth and battery life on mobile.
3. **Internal Event Listeners:** Implement `@OnEvent()` listeners to catch data produced by domain services.
* *Flow Example:* `EventEmitter fires 'internal.price.update' -> Gateway catches it -> Gateway emits 'price_update' to the specific Room.*


4. **Connection Management:** Log and manage client connections and disconnections (`OnGatewayConnection`, `OnGatewayDisconnect`) to monitor active concurrent users.
5. **(Optional but Recommended) Authentication Guard:** Secure the WebSocket connection ensuring only authenticated users (via JWT Token) can connect and receive data.

## Implementation Flow Example

1. Frontend sends WebSocket message: `{"action": "subscribe", "topic": "USDCLP"}`
2. Gateway adds the `socket.id` to the `"USDCLP"` room.
3. Domain Service (Currency) calculates new price and fires internal NestJS event.
4. Gateway catches internal event and broadcasts: `server.to("USDCLP").emit("price_update", payload)`

## Git Workflow & Documentation

* **Branching:** Create a new branch `feat/realtime-gateway`.
* **Unified Documentation:** Document the WebSocket Event Names (e.g., `subscribe`, `unsubscribe`, `price_update`) and their expected JSON payloads in the README within the same branch and PR.

---

 