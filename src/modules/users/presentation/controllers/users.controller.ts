import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '../../../../common/pipes/parse-object-id.pipe';
import { UsersService } from '../../application/services/users.service';
import { AddWatchlistDto } from '../dto/add-watchlist.dto';
import { ChangeEmailDto } from '../dto/change-email.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { FriendActionDto } from '../dto/friend-action.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getAuthenticatedUser(@CurrentUser() payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    return this.usersService.toProfile(user);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(payload.sub, dto);
    return this.usersService.toProfile(user);
  }

  @Patch('me/email')
  async changeEmail(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ) {
    await this.usersService.changeEmail(
      payload.sub,
      dto.currentPassword,
      dto.newEmail,
    );
    return {
      message:
        'Correo actualizado correctamente. Inicia sesión de nuevo para continuar.',
    };
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      payload.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return {
      message:
        'Contraseña actualizada correctamente. Inicia sesión de nuevo para continuar.',
    };
  }

  @Get('me/watchlist')
  async getWatchlist(@CurrentUser() payload: JwtPayload) {
    return this.usersService.getWatchlist(payload.sub);
  }

  @Post('me/watchlist')
  async addToWatchlist(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: AddWatchlistDto,
  ) {
    const user = await this.usersService.addToWatchlist(
      payload.sub,
      dto.symbols,
    );
    return { watchlist: user.watchlist };
  }

  @Delete('me/watchlist/:symbol')
  async removeFromWatchlist(
    @CurrentUser() payload: JwtPayload,
    @Param('symbol') symbol: string,
  ) {
    const user = await this.usersService.removeFromWatchlist(
      payload.sub,
      symbol,
    );
    return { watchlist: user.watchlist };
  }

  @Get('me/friends')
  async getFriends(@CurrentUser() payload: JwtPayload) {
    return this.usersService.getFriends(payload.sub);
  }

  @Get('me/friends/requests')
  async getFriendRequests(@CurrentUser() payload: JwtPayload) {
    return this.usersService.getPendingRequests(payload.sub);
  }

  @Post('me/friends/:userId')
  async sendFriendRequest(
    @CurrentUser() payload: JwtPayload,
    @Param('userId', ParseObjectIdPipe) friendId: string,
  ) {
    await this.usersService.sendFriendRequest(payload.sub, friendId);
    return { message: 'Solicitud de amistad enviada.' };
  }

  @Patch('me/friends/:userId')
  async acceptFriendRequest(
    @CurrentUser() payload: JwtPayload,
    @Param('userId', ParseObjectIdPipe) friendId: string,
    @Body() _dto: FriendActionDto,
  ) {
    void _dto.status;
    await this.usersService.acceptFriendRequest(payload.sub, friendId);
    return { message: 'Solicitud de amistad aceptada.' };
  }

  @Delete('me/friends/:userId')
  async removeFriend(
    @CurrentUser() payload: JwtPayload,
    @Param('userId', ParseObjectIdPipe) friendId: string,
  ) {
    await this.usersService.removeFriend(payload.sub, friendId);
    return { message: 'Amistad eliminada.' };
  }
}
