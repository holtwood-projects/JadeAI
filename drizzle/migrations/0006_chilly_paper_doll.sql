CREATE INDEX IF NOT EXISTS `chat_messages_session_id_created_idx` ON `chat_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chat_sessions_resume_id_idx` ON `chat_sessions` (`resume_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `interview_messages_round_id_idx` ON `interview_messages` (`round_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `interview_rounds_session_id_idx` ON `interview_rounds` (`session_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `interview_sessions_user_id_idx` ON `interview_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `resume_sections_resume_id_idx` ON `resume_sections` (`resume_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `resume_shares_resume_id_idx` ON `resume_shares` (`resume_id`);