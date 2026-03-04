import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBroadcastNotificationDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(800)
  body: string;

  @IsOptional()
  @IsIn([
    'practice_recommendation',
    'app_update',
    'admin_message',
    'lesson_update',
  ])
  category?: 'practice_recommendation' | 'app_update' | 'admin_message' | 'lesson_update';

  @IsOptional()
  @IsIn(['all', 'learner', 'instructor'])
  targetRole?: 'all' | 'learner' | 'instructor';

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
