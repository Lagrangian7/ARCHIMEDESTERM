CREATE TABLE "bbs_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"bbs_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"connection_type" varchar DEFAULT 'telnet' NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"duration" varchar,
	"bytes_transmitted" varchar DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bbs_favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bbs_id" varchar NOT NULL,
	"nickname" varchar,
	"notes" text,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bbs_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bbs_id" varchar NOT NULL,
	"rating" varchar NOT NULL,
	"review" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bbs_systems" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"host" varchar NOT NULL,
	"port" varchar NOT NULL,
	"phone_number" varchar,
	"location" varchar,
	"sysop_name" varchar,
	"sysop_email" varchar,
	"software" varchar,
	"nodes" varchar DEFAULT '1',
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked" timestamp,
	"last_online" timestamp,
	"connections_today" varchar DEFAULT '0',
	"total_connections" varchar DEFAULT '0',
	"features" text[],
	"categories" text[],
	"established_year" varchar,
	"rating" varchar DEFAULT '0',
	"rating_count" varchar DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" text NOT NULL,
	"mode" text DEFAULT 'natural' NOT NULL,
	"title" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"file_name" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"file_size" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"content" text NOT NULL,
	"object_path" varchar,
	"summary" text,
	"keywords" text[],
	"is_note" boolean DEFAULT false NOT NULL,
	"is_personality" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"last_accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"chunk_index" varchar NOT NULL,
	"content" text NOT NULL,
	"word_count" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "network_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_system_id" varchar NOT NULL,
	"to_system_id" varchar NOT NULL,
	"connection_type" varchar NOT NULL,
	"latency" varchar DEFAULT '0',
	"reliability" varchar DEFAULT '100',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"default_mode" text DEFAULT 'natural' NOT NULL,
	"voice_enabled" boolean DEFAULT false NOT NULL,
	"selected_voice" text DEFAULT 'default',
	"voice_rate" text DEFAULT '1',
	"terminal_theme" text DEFAULT 'classic',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "virtual_systems" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"hostname" varchar NOT NULL,
	"system_type" varchar NOT NULL,
	"description" text,
	"welcome_message" text,
	"motd" text,
	"file_system" jsonb DEFAULT '{}' NOT NULL,
	"commands" jsonb DEFAULT '[]' NOT NULL,
	"programs" jsonb DEFAULT '[]' NOT NULL,
	"networks" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "virtual_systems_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
ALTER TABLE "bbs_connections" ADD CONSTRAINT "bbs_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbs_connections" ADD CONSTRAINT "bbs_connections_bbs_id_bbs_systems_id_fk" FOREIGN KEY ("bbs_id") REFERENCES "public"."bbs_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbs_favorites" ADD CONSTRAINT "bbs_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbs_favorites" ADD CONSTRAINT "bbs_favorites_bbs_id_bbs_systems_id_fk" FOREIGN KEY ("bbs_id") REFERENCES "public"."bbs_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbs_ratings" ADD CONSTRAINT "bbs_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbs_ratings" ADD CONSTRAINT "bbs_ratings_bbs_id_bbs_systems_id_fk" FOREIGN KEY ("bbs_id") REFERENCES "public"."bbs_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_connections" ADD CONSTRAINT "network_connections_from_system_id_virtual_systems_id_fk" FOREIGN KEY ("from_system_id") REFERENCES "public"."virtual_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_connections" ADD CONSTRAINT "network_connections_to_system_id_virtual_systems_id_fk" FOREIGN KEY ("to_system_id") REFERENCES "public"."virtual_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");