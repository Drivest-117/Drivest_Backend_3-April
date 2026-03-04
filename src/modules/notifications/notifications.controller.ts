import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { ListMyNotificationsDto } from './dto/list-my-notifications.dto';
import { CreateBroadcastNotificationDto } from './dto/create-broadcast-notification.dto';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('v1/notifications/my')
  async myNotifications(
    @Req() req: { user: { userId: string } },
    @Query() query: ListMyNotificationsDto,
  ) {
    return this.notificationsService.listForUser(req.user.userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('v1/notifications/:id/read')
  async markRead(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('v1/notifications/read-all')
  async markAllRead(@Req() req: { user: { userId: string } }) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('v1/admin/notifications/broadcast')
  async broadcast(
    @Req() req: { user: { userId: string; role?: string } },
    @Body() dto: CreateBroadcastNotificationDto,
  ) {
    const role = (req.user.role ?? '').toString().toUpperCase();
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Admin role is required');
    }
    return this.notificationsService.broadcast(req.user.userId, dto);
  }
}
