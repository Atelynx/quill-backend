import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import {
  User,
  UserDocument,
} from '../../../users/infrastructure/schemas/user.schema';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  @Put(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: { role: dto.role } },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return {
      message: `Rol actualizado a "${dto.role}".`,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
