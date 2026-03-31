import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../application/services/users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getAuthenticatedUser(@CurrentUser() payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    return this.usersService.toProfile(user);
  }
}
