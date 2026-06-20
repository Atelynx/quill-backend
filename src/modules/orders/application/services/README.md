# Servicios de órdenes

Esta carpeta contiene creación, ejecución, cancelación y cálculo de comisiones
de órdenes.

`OrderExecutionService` conserva un guard local para evitar solapamientos dentro
del proceso y adquiere además `lock:orders:execution-cycle` en Redis mediante
`SET NX PX`. El lock expira después de 60 segundos y solo puede liberarlo la
ejecución propietaria.
