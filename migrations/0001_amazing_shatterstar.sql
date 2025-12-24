CREATE TABLE "wallpapers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"object_path" text,
	"data_url" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_selected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "terminal_theme" SET DEFAULT 'hacker';--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "terminal_theme" SET NOT NULL;