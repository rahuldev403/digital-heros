/**
 * Schema barrel.
 *
 * Drizzle needs every table and relation in one object to build the relational
 * query API and to diff migrations, so this file re-exports all of them. Import
 * tables from `@/db/schema` everywhere rather than reaching into the individual
 * modules — it keeps call sites stable if tables are later regrouped.
 */

export * from "./enums";
export * from "./auth";
export * from "./charity";
export * from "./billing";
export * from "./scores";
export * from "./draws";
export * from "./settings";
export * from "./relations";
