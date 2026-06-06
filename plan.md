# Plan: User Profile Features

## Overview
Add profile management features: username, email change, password change, friends system (with request/accept), and stock watchlist.

---

## 1. Schema Changes

### User Schema (`src/modules/users/infrastructure/schemas/user.schema.ts`)
Add:
```
username?: string      // unique, sparse index (ignore nulls), lowercase, trimmed
watchlist: string[]    // default [], array of stock symbols (e.g. ['AAPL', 'MSFT'])
```

### Friendship Schema — NEW file (`src/modules/users/infrastructure/schemas/friendship.schema.ts`)
```
userId: ObjectId       // ref: User, required
friendId: ObjectId     // ref: User, required
status: string         // 'pending' | 'accepted'
// timestamps: true
// compound unique index on (userId, friendId)
```

---

## 2. Registration — Auto-generate Username

- `RegisterDto` — add optional `username?` (`@IsOptional()`, `@IsString()`, `@MinLength(3)`, `@Matches(/^[a-zA-Z0-9_]+$/)`)
- `AuthService.register()` — pass username to `UsersService`
- `UsersService.createUser()` — generate random `user_XXXXXX` (6 hex chars) if not provided; check uniqueness and retry on collision

---

## 3. UsersService — New Methods

| Method | What it does |
|--------|-------------|
| `updateProfile(id, { fullName?, username? })` | Updates fields, checks username uniqueness |
| `changeEmail(id, currentPassword, newEmail)` | Verifies password, checks email not taken, updates, requires re-login (no new token) |
| `changePassword(id, currentPassword, newPassword)` | Verifies current password, bcrypt-hashes new one, saves, requires re-login |
| `addToWatchlist(id, symbols[])` | Push symbols to user's watchlist (deduplicate) |
| `removeFromWatchlist(id, symbol)` | Pull symbol from array |
| `getWatchlist(id)` | Return watchlist with stock data (join with Stock collection) |
| `sendFriendRequest(userId, friendId)` | Create friendship with status 'pending' |
| `acceptFriendRequest(userId, friendId)` | Update to 'accepted' |
| `removeFriend(userId, friendId)` | Delete friendship (both directions) |
| `getFriends(userId)` | Return list of accepted friend profiles |
| `getPendingRequests(userId)` | Return incoming pending requests |
| Extend `toProfile()` | Add `username`, `watchlist`, `friendsCount` |

---

## 4. Controller Endpoints — `UsersController`

All JWT-protected (`@UseGuards(JwtAuthGuard)`), use `@CurrentUser()` for userId.

| Method | Route | DTO | Purpose |
|--------|-------|-----|---------|
| `PATCH` | `/users/me` | `UpdateProfileDto` | Update fullName/username |
| `PATCH` | `/users/me/email` | `ChangeEmailDto` | Change email (re-login required) |
| `PATCH` | `/users/me/password` | `ChangePasswordDto` | Change password (re-login required) |
| `GET` | `/users/me/watchlist` | — | List watchlist with stock data |
| `POST` | `/users/me/watchlist` | `AddWatchlistDto` | Add symbols to watchlist |
| `DELETE` | `/users/me/watchlist/:symbol` | — | Remove symbol from watchlist |
| `GET` | `/users/me/friends` | — | List accepted friends |
| `GET` | `/users/me/friends/requests` | — | List incoming pending requests |
| `POST` | `/users/me/friends/:userId` | — | Send friend request |
| `PATCH` | `/users/me/friends/:userId` | `FriendActionDto` | Accept request |
| `DELETE` | `/users/me/friends/:userId` | — | Unfriend / cancel request |

Existing `GET /users/me` already returns `toProfile()` — extend that method instead of adding a new route.

---

## 5. New DTOs (`src/modules/users/presentation/dto/`)

| File | Fields | Validations |
|------|--------|-------------|
| `update-profile.dto.ts` | `fullName?`, `username?` | fullName: `@MinLength(3)`; username: `@MinLength(3)`, `@Matches(/^[a-zA-Z0-9_]+$/)` |
| `change-email.dto.ts` | `currentPassword: string`, `newEmail: string` | newEmail: `@IsEmail()` |
| `change-password.dto.ts` | `currentPassword: string`, `newPassword: string` | newPassword: `@MinLength(8)` |
| `add-watchlist.dto.ts` | `symbols: string[]` | `@ArrayNotEmpty()`, `@IsString({ each: true })` |
| `friend-action.dto.ts` | `status: 'accepted'` | `@IsString()`, `@IsIn(['accepted'])` |

---

## 6. Friendship Collection Design

- Stored as separate documents (not embedded) for queryability
- Compound unique index on `(userId, friendId)` prevents duplicates
- Queries check both directions to avoid double-friend scenarios
- When removing a friend, delete documents in both directions (`(userId, friendId)` and `(friendId, userId)`)

---

## 7. Security Decisions

- **Email change**: verify `currentPassword`, update email, NO new JWT issued → client must re-login
- **Password change**: verify `currentPassword`, hash+savenew password, NO new JWT issued → client must re-login
- Both return: `{ message: "... Please log in again." }`
- Old JWT remains valid until natural expiration (no blacklist mechanism yet)

---

## 8. Files to Modify

- `src/modules/users/infrastructure/schemas/user.schema.ts`
- `src/modules/users/domain/entities/user.entity.ts`
- `src/modules/users/application/services/users.service.ts`
- `src/modules/users/application/services/users.service.spec.ts`
- `src/modules/users/presentation/controllers/users.controller.ts`
- `src/modules/users/users.module.ts`
- `src/modules/auth/presentation/dto/register.dto.ts`
- `src/modules/auth/application/services/auth.service.ts`

## 9. Files to Create

- `src/modules/users/infrastructure/schemas/friendship.schema.ts`
- `src/modules/users/presentation/dto/update-profile.dto.ts`
- `src/modules/users/presentation/dto/change-email.dto.ts`
- `src/modules/users/presentation/dto/change-password.dto.ts`
- `src/modules/users/presentation/dto/add-watchlist.dto.ts`
- `src/modules/users/presentation/dto/friend-action.dto.ts`
- `src/modules/users/presentation/controllers/users.controller.spec.ts`
