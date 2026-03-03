import { IsIn } from 'class-validator';

export class UpdateLessonStatusDto {
  @IsIn(['completed', 'cancelled'])
  status: 'completed' | 'cancelled';
}
