import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { BulkAssignDto } from './dto/bulk-assign.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('COORDINATOR', 'ADMIN')
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll({
      role: query.role,
      programId: query.programId,
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      includeInactive: query.includeInactive === 'true',
    });
  }

  @Get('stats')
  @Roles('COORDINATOR', 'ADMIN')
  getStats() {
    return this.usersService.getUsersStats();
  }

  @Get('programs')
  getPrograms() {
    return this.usersService.getPrograms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles('COORDINATOR', 'ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @Roles('COORDINATOR', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id')
  @Roles('COORDINATOR', 'ADMIN')
  patch(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('COORDINATOR', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.usersService.softDelete(id);
  }

  @Post(':id/reactivate')
  @Roles('ADMIN')
  reactivate(@Param('id') id: string) {
    return this.usersService.reactivate(id);
  }

  @Post(':studentId/assign-advisor/:advisorId')
  @Roles('COORDINATOR', 'ADMIN')
  assignAdvisor(
    @Param('studentId') studentId: string,
    @Param('advisorId') advisorId: string,
  ) {
    return this.usersService.assignAdvisor(studentId, advisorId);
  }

  @Post('bulk-assign-advisor')
  @Roles('COORDINATOR', 'ADMIN')
  bulkAssignAdvisor(@Body() dto: BulkAssignDto) {
    return this.usersService.bulkAssignAdvisor(dto.studentIds, dto.advisorId);
  }

  @Post(':id/reset-password')
  @Roles('ADMIN')
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }

  @Put('me/profile')
  updateProfile(@Request() req: any, @Body() body: any) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Patch('me/settings')
  updateSettings(@Request() req: any, @Body() body: Record<string, any>) {
    return this.usersService.updateSettings(req.user.sub, body);
  }

  @Get('me/login-history')
  getLoginHistory(@Request() req: any) {
    return this.usersService.getLoginHistory(req.user.sub);
  }

  @Get('me/sessions')
  getSessions(@Request() req: any) {
    return this.usersService.getLoginHistory(req.user.sub);
  }

  @Delete('me/sessions')
  logoutAllDevices(@Request() req: any) {
    return this.usersService.logoutAllDevices(req.user.sub);
  }
}
