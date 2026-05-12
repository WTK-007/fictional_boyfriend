CREATE TYPE "public"."api_status" AS ENUM('success', 'failure', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."api_type" AS ENUM('chat', 'tts', 'image');--> statement-breakpoint
CREATE TYPE "public"."audio_status" AS ENUM('pending', 'done', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."image_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('audio', 'image');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'character');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'voice', 'image');--> statement-breakpoint
CREATE TABLE "api_usage_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"api_type" "api_type" NOT NULL,
	"status" "api_status" NOT NULL,
	"latency_ms" integer,
	"tokens_in" integer,
	"tokens_out" integer,
	"chars_count" integer,
	"error_code" varchar(50),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"tagline" varchar(200) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avatar_url" varchar(500) NOT NULL,
	"speaker" varchar(64) NOT NULL,
	"system_prompt" text NOT NULL,
	"appearance" text NOT NULL,
	"voice_style" varchar(100),
	"image_style" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"title" varchar(100),
	"message_count" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "media_type" NOT NULL,
	"uri" varchar(500) NOT NULL,
	"size_bytes" integer,
	"prompt" text,
	"source_text" text,
	"provider" varchar(50),
	"cost_credits" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"raw_content" text,
	"audio_uri" varchar(500),
	"audio_duration_ms" integer,
	"audio_status" "audio_status",
	"image_uri" varchar(500),
	"image_prompt" text,
	"image_status" "image_status",
	"client_msg_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_character_state" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"character_id" varchar(32) NOT NULL,
	"intimacy_level" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"memory_summary" text,
	"user_facts" jsonb DEFAULT '{}'::jsonb,
	"first_chat_at" timestamp with time zone,
	"last_chat_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uid" varchar(64) NOT NULL,
	"nickname" varchar(50),
	"avatar_url" varchar(500),
	"device_fingerprint" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_character_state" ADD CONSTRAINT "user_character_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_character_state" ADD CONSTRAINT "user_character_state_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_logs_user_time_idx" ON "api_usage_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "api_logs_type_time_idx" ON "api_usage_logs" USING btree ("api_type","created_at");--> statement-breakpoint
CREATE INDEX "conversations_user_last_msg_idx" ON "conversations" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_user_char_idx" ON "conversations" USING btree ("user_id","character_id");--> statement-breakpoint
CREATE INDEX "media_user_type_idx" ON "media_assets" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "messages_conv_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_client_msg_idx" ON "messages" USING btree ("client_msg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_character_unique_idx" ON "user_character_state" USING btree ("user_id","character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_uid_idx" ON "users" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "users_device_idx" ON "users" USING btree ("device_fingerprint");