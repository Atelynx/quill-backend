import { AdminUsersController } from './admin-users.controller';

describe('AdminUsersController', () => {
  it('actualiza el rol e invalida los tokens anteriores', async () => {
    const userModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@quill.dev',
        role: 'admin',
      }),
    };
    const controller = new AdminUsersController(userModel as never);

    await controller.updateRole('user-1', { role: 'admin' });

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-1',
      { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } },
      { returnDocument: 'after' },
    );
  });
});
