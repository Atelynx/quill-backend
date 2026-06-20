# Servicios de currency

Esta carpeta contiene los servicios de consulta, anclaje y simulación de precios
de currency.

`CurrencyTickService` actualiza `forex:{symbol}:live_price` con un TTL de 60
segundos. `CurrencyAnchorService` aplica el mismo TTL cuando inicializa un precio
vivo inexistente. Esta política evita conservar precios vivos obsoletos
indefinidamente.
