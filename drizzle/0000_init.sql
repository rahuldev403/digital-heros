CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."draw_mode" AS ENUM('random', 'algorithmic');--> statement-breakpoint
CREATE TYPE "public"."draw_status" AS ENUM('draft', 'simulated', 'published');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"charity_id" uuid,
	"charity_percent" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_charity_percent_range" CHECK ("users"."charity_percent" >= 10 AND "users"."charity_percent" <= 100)
);
--> statement-breakpoint
CREATE TABLE "charities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"location" text,
	"website_url" text,
	"logo_url" text,
	"cover_image_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text,
	"image_url" text,
	"registration_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"charity_id" uuid NOT NULL,
	"donor_name" text,
	"donor_email" text,
	"message" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "donation_status" DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"stripe_invoice_id" text,
	"stripe_payment_intent_id" text,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"period_key" text NOT NULL,
	"charity_id" uuid,
	"charity_percent" integer NOT NULL,
	"charity_amount_minor" integer NOT NULL,
	"prize_pool_share_bps" integer NOT NULL,
	"prize_pool_amount_minor" integer NOT NULL,
	"platform_amount_minor" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"prize_pool_share_bps" integer NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"played_on" date NOT NULL,
	"points" integer NOT NULL,
	"course_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_points_range" CHECK ("scores"."points" >= 1 AND "scores"."points" <= 45)
);
--> statement-breakpoint
CREATE TABLE "draw_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"numbers" integer[] NOT NULL,
	"score_snapshot" jsonb,
	"match_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draw_winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	"matched_numbers" integer[] NOT NULL,
	"tier_pool_minor" integer NOT NULL,
	"winners_in_tier" integer NOT NULL,
	"prize_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"payout_status" "payout_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by" uuid,
	"payout_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_key" text NOT NULL,
	"name" text NOT NULL,
	"status" "draw_status" DEFAULT 'draft' NOT NULL,
	"mode" "draw_mode" DEFAULT 'random' NOT NULL,
	"numbers_per_entry" integer NOT NULL,
	"number_min" integer NOT NULL,
	"number_max" integer NOT NULL,
	"winning_numbers" integer[],
	"random_seed" text,
	"base_pool_minor" integer DEFAULT 0 NOT NULL,
	"rollover_in_minor" integer DEFAULT 0 NOT NULL,
	"total_pool_minor" integer DEFAULT 0 NOT NULL,
	"rollover_out_minor" integer DEFAULT 0 NOT NULL,
	"undistributed_minor" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"active_subscriber_count" integer DEFAULT 0 NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"tier_shares_bps" jsonb,
	"draw_date" timestamp with time zone NOT NULL,
	"simulated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "winner_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_winner_id" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text,
	"mime_type" text,
	"file_size_bytes" integer,
	"note" text,
	"status" "verification_status" DEFAULT 'submitted' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_charity_id_charities_id_fk" FOREIGN KEY ("charity_id") REFERENCES "public"."charities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charity_events" ADD CONSTRAINT "charity_events_charity_id_charities_id_fk" FOREIGN KEY ("charity_id") REFERENCES "public"."charities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_charity_id_charities_id_fk" FOREIGN KEY ("charity_id") REFERENCES "public"."charities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_charity_id_charities_id_fk" FOREIGN KEY ("charity_id") REFERENCES "public"."charities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_entries" ADD CONSTRAINT "draw_entries_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_entries" ADD CONSTRAINT "draw_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_winners" ADD CONSTRAINT "draw_winners_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_winners" ADD CONSTRAINT "draw_winners_entry_id_draw_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."draw_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_winners" ADD CONSTRAINT "draw_winners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_winners" ADD CONSTRAINT "draw_winners_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winner_verifications" ADD CONSTRAINT "winner_verifications_draw_winner_id_draw_winners_id_fk" FOREIGN KEY ("draw_winner_id") REFERENCES "public"."draw_winners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winner_verifications" ADD CONSTRAINT "winner_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_charity_idx" ON "users" USING btree ("charity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "charities_slug_key" ON "charities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "charities_active_idx" ON "charities" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "charities_category_idx" ON "charities" USING btree ("category");--> statement-breakpoint
CREATE INDEX "charity_events_charity_idx" ON "charity_events" USING btree ("charity_id");--> statement-breakpoint
CREATE INDEX "charity_events_starts_at_idx" ON "charity_events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_stripe_session_key" ON "donations" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "donations_charity_idx" ON "donations" USING btree ("charity_id");--> statement-breakpoint
CREATE INDEX "donations_user_idx" ON "donations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "donations_status_idx" ON "donations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_stripe_invoice_key" ON "payments" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_period_idx" ON "payments" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "payments_charity_idx" ON "payments" USING btree ("charity_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_key" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_stripe_price_key" ON "plans" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_sub_key" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_period_end_idx" ON "subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_user_date_key" ON "scores" USING btree ("user_id","played_on");--> statement-breakpoint
CREATE INDEX "scores_user_played_on_idx" ON "scores" USING btree ("user_id","played_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "draw_entries_draw_user_key" ON "draw_entries" USING btree ("draw_id","user_id");--> statement-breakpoint
CREATE INDEX "draw_entries_draw_idx" ON "draw_entries" USING btree ("draw_id");--> statement-breakpoint
CREATE INDEX "draw_entries_user_idx" ON "draw_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "draw_entries_match_idx" ON "draw_entries" USING btree ("draw_id","match_count");--> statement-breakpoint
CREATE UNIQUE INDEX "draw_winners_entry_key" ON "draw_winners" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "draw_winners_draw_idx" ON "draw_winners" USING btree ("draw_id");--> statement-breakpoint
CREATE INDEX "draw_winners_user_idx" ON "draw_winners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "draw_winners_verification_idx" ON "draw_winners" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "draw_winners_payout_idx" ON "draw_winners" USING btree ("payout_status");--> statement-breakpoint
CREATE UNIQUE INDEX "draws_period_key" ON "draws" USING btree ("period_key");--> statement-breakpoint
CREATE INDEX "draws_status_idx" ON "draws" USING btree ("status");--> statement-breakpoint
CREATE INDEX "draws_draw_date_idx" ON "draws" USING btree ("draw_date");--> statement-breakpoint
CREATE INDEX "winner_verifications_winner_idx" ON "winner_verifications" USING btree ("draw_winner_id");--> statement-breakpoint
CREATE INDEX "winner_verifications_status_idx" ON "winner_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST);