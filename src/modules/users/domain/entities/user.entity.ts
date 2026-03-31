export interface UserEntity {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  availableBalance: number;
  reservedBalance: number;
  createdAt: Date;
  updatedAt: Date;
}
