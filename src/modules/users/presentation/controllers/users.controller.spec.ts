import { UsersController } from './users.controller';

describe('UsersController friends contract', () => {
  const payload = { sub: 'user-1' };

  it('retorna el contrato estable de amigos', async () => {
    const friends = [
      {
        _id: 'friend-1',
        id: 'friend-1',
        fullName: 'Friend',
        email: 'friend@quill.dev',
        username: 'friend_user',
      },
    ];
    const controller = new UsersController({
      getFriends: jest.fn().mockResolvedValue(friends),
    } as never);

    await expect(controller.getFriends(payload as never)).resolves.toBe(
      friends,
    );
  });

  it('retorna el contrato estable de solicitudes pendientes', async () => {
    const requests = [
      {
        _id: 'request-1',
        from: { _id: 'friend-1', fullName: 'Friend' },
        status: 'pending',
        createdAt: new Date(),
      },
    ];
    const controller = new UsersController({
      getPendingRequests: jest.fn().mockResolvedValue(requests),
    } as never);

    await expect(controller.getFriendRequests(payload as never)).resolves.toBe(
      requests,
    );
  });
});
