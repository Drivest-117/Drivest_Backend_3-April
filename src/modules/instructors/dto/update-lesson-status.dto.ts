import { IsIn } from 'class-validator';

export class UpdateLessonStatusDto {
  @IsIn(['accepted', 'declined', 'completed', 'cancelled'])
  status: 'accepted' | 'declined' | 'completed' | 'cancelled';
}
