# Order Flow

## Flujo general

El backend trabaja con ordenes limitadas y un ciclo periodico de mercado.

Secuencia:

1. El usuario crea una orden `BUY` o `SELL`.
2. La orden queda en estado `PENDING`.
3. El scheduler actualiza precios del mercado.
4. El backend revisa ordenes pendientes.
5. Si el precio cumple la condicion, la orden se ejecuta.
6. Se actualizan usuario, posicion, orden y trade en la misma transaccion.

## Creacion de orden

Servicio principal:

- `src/modules/orders/application/services/orders.service.ts`

### Compra

Al crear una orden `BUY`:

- normaliza simbolo y cantidad
- calcula monto bruto `quantity * limitPrice`
- calcula comision estimada
- reserva `grossAmount + commission`
- descuenta saldo disponible
- aumenta saldo reservado

### Venta

Al crear una orden `SELL`:

- busca la posicion del usuario para ese simbolo
- valida cantidad libre no reservada
- aumenta `reservedQuantity`

## Ejecucion automatica

Servicio principal:

- `src/modules/orders/application/services/order-execution.service.ts`

El ciclo ejecuta cada `MARKET_TICK_INTERVAL_SECONDS`:

1. obtiene cotizaciones actuales con `MarketService.listQuotes()` (solo lectura, sin refresh)
2. intenta ejecutar ordenes pendientes contra esas cotizaciones

### Condiciones de ejecucion

- `BUY`: se ejecuta si `marketPrice <= limitPrice`
- `SELL`: se ejecuta si `marketPrice >= limitPrice`

## Efectos de una ejecucion BUY

- libera saldo reservado de la orden
- devuelve al saldo disponible la diferencia entre reserva y costo real
- crea o actualiza la posicion del usuario
- guarda precio de ejecucion y comision
- registra un trade

## Efectos de una ejecucion SELL

- reduce cantidad y reserva de la posicion
- aumenta saldo disponible con el neto vendido
- elimina la posicion si queda en cero
- guarda precio de ejecucion y comision
- registra un trade

## Consistencia

La ejecucion usa `session.withTransaction(...)` sobre MongoDB.

Eso evita dejar el sistema en estados parciales si falla una parte del proceso.
