# Scripts operativos

- `create-admin.ts` crea o promueve un usuario administrador mediante
  `npm run create:admin`. Requiere una contraseña explícita de al menos 12
  caracteres con mayúsculas, minúsculas y números.
- `admin-password.ts` concentra la validación de contraseña usada por el script.
- `admin-password.spec.ts` cubre contraseñas válidas e inseguras.

El script carga la configuración de entorno existente y se conecta directamente
a MongoDB. No persiste ni registra la contraseña recibida.
