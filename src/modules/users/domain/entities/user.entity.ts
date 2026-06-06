export interface UserEntity {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  availableBalance: number;
  reservedBalance: number;
  username?: string;
  watchlist: string[];
  createdAt: Date;
  updatedAt: Date;
}
