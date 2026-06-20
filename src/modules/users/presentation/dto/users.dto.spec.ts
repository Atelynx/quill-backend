import { validate } from 'class-validator';
import { AddWatchlistDto } from './add-watchlist.dto';
import { UpdateProfileDto } from './update-profile.dto';

describe('Users DTO validation', () => {
  it('acepta limites validos de perfil y watchlist', async () => {
    const profile = Object.assign(new UpdateProfileDto(), {
      fullName: 'A'.repeat(100),
      username: 'u'.repeat(30),
    });
    const watchlist = Object.assign(new AddWatchlistDto(), {
      symbols: ['AAPL', 'BRK.B', 'SELL-SN'],
    });

    await expect(validate(profile)).resolves.toHaveLength(0);
    await expect(validate(watchlist)).resolves.toHaveLength(0);
  });

  it('rechaza textos de perfil sobre el limite', async () => {
    const dto = Object.assign(new UpdateProfileDto(), {
      fullName: 'A'.repeat(101),
      username: 'u'.repeat(31),
    });

    expect(await validate(dto)).toHaveLength(2);
  });

  it('rechaza watchlists demasiado grandes o con formato invalido', async () => {
    const tooLarge = Object.assign(new AddWatchlistDto(), {
      symbols: Array.from({ length: 51 }, (_, index) => `SYM${index}`),
    });
    const invalid = Object.assign(new AddWatchlistDto(), {
      symbols: ['AAPL', 'INVALID SYMBOL'],
    });

    expect(await validate(tooLarge)).not.toHaveLength(0);
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
