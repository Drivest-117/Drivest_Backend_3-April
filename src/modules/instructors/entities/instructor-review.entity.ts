import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { InstructorEntity } from "./instructor.entity";
import { User } from "../../../entities/user.entity";
import { LessonEntity } from "./lesson.entity";
import { DB_AWARE_TIMESTAMP_TYPE } from "../../../database/db-column-types";

export type InstructorReviewStatus =
  | "pending"
  | "visible"
  | "flagged"
  | "hidden"
  | "removed";

@Entity({ name: "instructor_reviews" })
@Unique("UQ_instructor_review_lesson", [
  "instructorId",
  "learnerUserId",
  "lessonId",
])
@Check("CHK_instructor_reviews_rating_range", "rating >= 1 AND rating <= 5")
export class InstructorReviewEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "instructor_id", type: "uuid" })
  instructorId: string;

  @ManyToOne(() => InstructorEntity, (instructor) => instructor.reviews)
  @JoinColumn({ name: "instructor_id" })
  instructor: InstructorEntity;

  @Column({ name: "learner_user_id", type: "uuid" })
  learnerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "learner_user_id" })
  learnerUser: User;

  @Column({ name: "rating", type: "int" })
  rating: number;

  @Column({ name: "review_text", type: "text", nullable: true })
  reviewText: string | null;

  @Column({ name: "lesson_id", type: "uuid" })
  lessonId: string;

  @ManyToOne(() => LessonEntity, (lesson) => lesson.reviews)
  @JoinColumn({ name: "lesson_id" })
  lesson: LessonEntity;

  @Column({ name: "status", type: "text", default: "visible" })
  status: InstructorReviewStatus;

  @Column({ name: "reported_count", type: "int", default: 0 })
  reportedCount: number;

  @Column({ name: "last_reported_reason_code", type: "text", nullable: true })
  lastReportedReasonCode: string | null;

  @Column({ name: "last_reported_note", type: "text", nullable: true })
  lastReportedNote: string | null;

  @Column({
    name: "last_reported_at",
    type: DB_AWARE_TIMESTAMP_TYPE,
    nullable: true,
  } as any)
  lastReportedAt: Date | null;

  @Column({ name: "moderation_reason", type: "text", nullable: true })
  moderationReason: string | null;

  @Column({ name: "moderated_by_user_id", type: "uuid", nullable: true })
  moderatedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "moderated_by_user_id" })
  moderatedByUser: User | null;

  @Column({
    name: "moderated_at",
    type: DB_AWARE_TIMESTAMP_TYPE,
    nullable: true,
  } as any)
  moderatedAt: Date | null;

  @CreateDateColumn({
    name: "created_at",
    type: DB_AWARE_TIMESTAMP_TYPE,
  } as any)
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: DB_AWARE_TIMESTAMP_TYPE,
  } as any)
  updatedAt: Date;

  @DeleteDateColumn({
    name: "deleted_at",
    type: DB_AWARE_TIMESTAMP_TYPE,
    nullable: true,
  } as any)
  deletedAt: Date | null;
}
