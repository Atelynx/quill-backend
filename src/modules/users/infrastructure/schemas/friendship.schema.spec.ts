import { FriendshipSchema } from './friendship.schema';

describe('FriendshipSchema', () => {
  it('define índices para solicitudes pendientes y amistades aceptadas', () => {
    const indexes = FriendshipSchema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ userId: 1, friendId: 1 }, { unique: true }],
        [{ friendId: 1, status: 1, createdAt: -1 }, {}],
        [{ userId: 1, status: 1 }, {}],
        [{ friendId: 1, status: 1 }, {}],
      ]),
    );
  });
});
