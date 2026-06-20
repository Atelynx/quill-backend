# Backend Plan: Admin Config Update Flow Fix

## Problem

1. `CURRENCY_PROVIDER` is not seeded at startup (`SEED_CONFIGS`) — never appears in the admin panel
2. `CURRENCY_PROVIDER` is not flagged as restart-required (`RESTART_REQUIRED_KEYS`) — frontend shows no restart warning despite the currency module reading it at factory time
3. `updatedBy` is never populated in `create()` and `update()` — no audit trail of who changed a config

---

## Changes

### 1. `admin-config.schema.ts` — Add missing seed config and restart key

**File:** `src/modules/admin/infrastructure/schemas/admin-config.schema.ts`

**A. Add `CURRENCY_PROVIDER` to `RESTART_REQUIRED_KEYS`** (~line 6):

```ts
export const RESTART_REQUIRED_KEYS = new Set([
  'MARKET_PROVIDER',
  'SIMULATION_STRATEGY',
  'CURRENCY_PROVIDER',   // ← ADD
]);
```

**Why:** `currency.module.ts` (line 48) reads `CURRENCY_PROVIDER` via `adminConfigService.get()` inside a `useFactory` provider, which runs at module initialization. Changing this value requires a server restart. Adding it to `RESTART_REQUIRED_KEYS` ensures:
- The GET response sets `appliesOn: 'restart'`
- The frontend shows the restart warning badge
- The `effectiveValue` field is populated (env var fallback)

**B. Add `CURRENCY_PROVIDER` to `SEED_CONFIGS`** (after `CURRENCY_SIMULATION_STRATEGY`, ~line 66):

```ts
{
  key: 'CURRENCY_PROVIDER',
  envKey: 'CURRENCY_PROVIDER',
  defaultValue: 'mock',
  name: 'Proveedor de datos de monedas',
  tags: ['currency', 'provider'],
},
```

**Why:** Without this seed entry, `CURRENCY_PROVIDER` never gets inserted into the `admin_configs` collection at startup. The `currency.module.ts` factory calls `adminConfigService.get('CURRENCY_PROVIDER')` which returns `null`, falling back to the env var. The admin panel never shows this key for editing. Adding it to `SEED_CONFIGS` ensures it is created on the next server startup (or when the `onModuleInit` lifecycle hook runs) with the env var value or default `'mock'`.

---

### 2. `admin.controller.ts` — Populate `updatedBy` on create and update

**File:** `src/modules/admin/presentation/controllers/admin.controller.ts`

**Current:** Both `create()` (~line 79) and `update()` (~line 87) call `adminConfigService.set()` without passing `updatedBy`.

**Change — Add `@CurrentUser()` decorator and pass `user.sub`:**

**Imports (add):**
```ts
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
```

**`create()` method (~line 79):**
```ts
@Post()
async create(@Body() dto: CreateConfigDto, @CurrentUser() user: JwtPayload) {
  return this.adminConfigService.set(dto.key, dto.value, {
    name: dto.name,
    tags: dto.tags,
    updatedBy: user.sub,        // ← ADD
  });
}
```

**`update()` method (~line 87):**
```ts
@Put(':key')
async update(
  @Param('key') key: string,
  @Body() dto: UpsertConfigDto,
  @CurrentUser() user: JwtPayload,   // ← ADD
) {
  const existing = await this.adminConfigService.getFull(key);
  if (!existing) {
    throw new NotFoundException(`Configuración "${key}" no encontrada.`);
  }

  return this.adminConfigService.set(key, dto.value, {
    name: dto.name,
    tags: dto.tags,
    updatedBy: user.sub,        // ← ADD
  });
}
```

**Why:** The `AdminConfig` schema already defines `updatedBy` (ObjectId ref to User). The service `set()` method already accepts `updatedBy` in its options and converts it to `Types.ObjectId`. Only the controller is missing the plumbing. Adding `@CurrentUser()` follows the existing pattern used in `portfolio.controller.ts`, `orders.controller.ts`, `users.controller.ts`, etc.

**No change needed to `toResponse()`:** The DTO already correctly returns both `value` (DB) and `effectiveValue` (env var for restart-required keys). The frontend display fix is handled in the frontend plan.

---

### 3. No changes needed to `admin-config.service.ts`

The service layer is correct:
- `set()` properly marks old versions `inUse: false` and creates a new version
- `updatedBy` option is accepted and converted to `ObjectId`
- `SEED_CONFIGS` are seeded in `onModuleInit()` — adding `CURRENCY_PROVIDER` to the array is sufficient

---

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `src/modules/admin/infrastructure/schemas/admin-config.schema.ts` | Edit — add `CURRENCY_PROVIDER` to `RESTART_REQUIRED_KEYS` and `SEED_CONFIGS` |
| 2 | `src/modules/admin/presentation/controllers/admin.controller.ts` | Edit — add `@CurrentUser()` to `create()` and `update()`, pass `updatedBy` to service |

---

## Verification

1. Start the server (fresh or existing DB)
2. Call `GET /admin/config` → verify `CURRENCY_PROVIDER` is present with:
   - `key: "CURRENCY_PROVIDER"`, `value: "mock"` (or env var value)
   - `appliesOn: "restart"`
   - `effectiveValue` set to env var or `"mock"`
3. Call `PUT /admin/config/MARKET_PROVIDER` with `{ "value": "eodhd" }` → verify response includes `updatedBy` with a valid ObjectId
4. Call `GET /admin/config/MARKET_PROVIDER/history` → verify the version history shows entries with `updatedBy` populated
