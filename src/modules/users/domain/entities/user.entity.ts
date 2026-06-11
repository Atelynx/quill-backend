import type { UserRole } from '../../../../common/types/role.type';

export interface UserEntity {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  availableBalance: number;
  reservedBalance: number;
  username?: string;
  watchlist: string[];
  createdAt: Date;
  updatedAt: Date;
}
