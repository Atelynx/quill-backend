# Utilidades comunes

Esta carpeta contiene funciones reutilizables sin dependencias de módulos de
negocio.

- `market-hours.ts` convierte horarios y determina si el mercado está abierto
  usando la zona `America/Santiago`, el horario configurado y días hábiles de
  lunes a viernes. Los feriados bursátiles quedan fuera del alcance actual.
- `currency-mapper.ts` resuelve monedas por símbolo y mantiene su caché local.
- Los archivos `*.spec.ts` verifican el comportamiento de estas utilidades.

Los módulos de mercado y órdenes usan `market-hours.ts` para bloquear consultas
operativas y ejecuciones cuando el mercado está cerrado.
