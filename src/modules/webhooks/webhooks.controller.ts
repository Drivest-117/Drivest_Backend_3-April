import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { RevenueCatEventDto } from './dto/revenuecat-event.dto';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private webhookService: WebhooksService,
    private configService: ConfigService,
  ) {}

  @Post('revenuecat')
  async revenuecat(
    @Body() body: any,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-revenuecat-signature') signature?: string,
  ) {
    const secret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Webhook secret not configured');
    }
    if (!signature) {
      throw new BadRequestException('Signature missing');
    }
    const payload = req.rawBody ?? Buffer.from(JSON.stringify(body));
    this.webhookService.verifySignature(payload, signature, secret);
    const event: RevenueCatEventDto = {
      eventId: body.event_id || body.eventId,
      productId: body.product_id || body.productId,
      transactionId: body.transaction_id || body.transactionId,
      userId: body.app_user_id || body.userId,
      type: body.type,
      raw: body,
      purchasedAt: body.purchased_at || new Date().toISOString(),
      expiresAt: body.expiration_at,
    };
    return this.webhookService.handleRevenueCat(event);
  }
}
