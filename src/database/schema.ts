import { pgTable, smallint, integer, varchar, decimal, boolean, bigint, serial, primaryKey, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Anime table
export const anime = pgTable("anime", {
    alid: integer("alid").primaryKey(),
    enname: varchar("enname", { length: 200 }).notNull(),
    jpname: varchar("jpname", { length: 200 }).notNull(),
    optnames: varchar("optnames").array().notNull(),
    excludenames: varchar("excludenames").array().notNull(),
    status: varchar("status", { length: 16 }),
    next_ep_num: decimal("next_ep_num"),
    next_ep_air: integer("next_ep_air"),
    last_ep: smallint("last_ep"),
    ep_extras: decimal("ep_extras").array().notNull(),
    imglink: varchar("imglink", { length: 255 }),
    fileid: varchar("fileid", { length: 100 }),
});

// Users table
export const users = pgTable("users", {
    userid: smallint("userid").primaryKey().generatedByDefaultAsIdentity(),
    chatid: bigint("chatid", { mode: "bigint" }),
    username: varchar("username", { length: 255 }),
}, (table) => ({
    uniqueChatid: unique("unique_chatid").on(table.chatid),
    useridChatidUnique: unique("userid_chatid_unique").on(table.userid, table.chatid),
}));

// Completed anime table
export const completedanime = pgTable("completedanime", {
    userid: integer("userid").primaryKey().references(() => users.userid, { onDelete: "cascade" }),
    completed: integer("completed").array().notNull(),
});

// Config table
export const config = pgTable("config", {
    userid: integer("userid").primaryKey().references(() => users.userid, { onDelete: "cascade" }),
    pause_airing_updates: boolean("pause_airing_updates").default(false),
});

// Sync updates table
export const syncupd = pgTable("syncupd", {
    userid: integer("userid").notNull().references(() => users.userid, { onDelete: "cascade" }),
    queuenum: smallint("queuenum").primaryKey().generatedByDefaultAsIdentity(),
    synctype: varchar("synctype", { length: 20 }),
    anime: varchar("anime", { length: 255 }),
    epnum: decimal("epnum"),
    dltype: varchar("dltype", { length: 10 }),
    xdccdata: varchar("xdccdata").array().notNull(),
    torrentdata: varchar("torrentdata", { length: 255 }),
});

// Watched episodes anime table
export const watchedepanime = pgTable("watchedepanime", {
    userid: integer("userid").notNull().references(() => users.userid, { onDelete: "cascade" }),
    alid: integer("alid").notNull().references(() => anime.alid, { onDelete: "cascade" }),
    ep: decimal("ep").array().notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.userid, table.alid] }),
    watchedepanimeUserAnimeUnique: unique("watchedepanime_user_anime_unique").on(table.userid, table.alid),
}));

// Watchlists table
export const watchlists = pgTable("watchlists", {
    watchlistid: smallint("watchlistid").primaryKey().generatedByDefaultAsIdentity(),
    watchlist_name: varchar("watchlist_name", { length: 255 }),
    alid: integer("alid").array().notNull(),
    generated_by: integer("generated_by").notNull().references(() => users.userid, { onDelete: "cascade" }),
});

// Airing updates table
export const airingupdates = pgTable("airingupdates", {
    alid: integer("alid").primaryKey().references(() => anime.alid, { onDelete: "cascade", onUpdate: "no action" }),
    userid: integer("userid").array().notNull(),
});

// Watching anime table
export const watchinganime = pgTable("watchinganime", {
    userid: integer("userid").primaryKey().references(() => users.userid, { onDelete: "cascade" }),
    alid: integer("alid").array().notNull(),
});

// Relations
export const animeRelations = relations(anime, ({ one, many }) => ({
    airingupdates: one(airingupdates, {
        fields: [anime.alid],
        references: [airingupdates.alid],
    }),
    watchedepanime: many(watchedepanime),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
    completedanime: one(completedanime, {
        fields: [users.userid],
        references: [completedanime.userid],
    }),
    config: one(config, {
        fields: [users.userid],
        references: [config.userid],
    }),
    syncupd: many(syncupd),
    watchedepanime: many(watchedepanime),
    watchinganime: one(watchinganime, {
        fields: [users.userid],
        references: [watchinganime.userid],
    }),
    watchlists: many(watchlists),
}));

export const watchedepanimeRelations = relations(watchedepanime, ({ one }) => ({
    anime: one(anime, {
        fields: [watchedepanime.alid],
        references: [anime.alid],
    }),
    user: one(users, {
        fields: [watchedepanime.userid],
        references: [users.userid],
    }),
}));

export const watchlistsRelations = relations(watchlists, ({ one }) => ({
    user: one(users, {
        fields: [watchlists.generated_by],
        references: [users.userid],
    }),
}));

export const syncupdRelations = relations(syncupd, ({ one }) => ({
    user: one(users, {
        fields: [syncupd.userid],
        references: [users.userid],
    }),
}));

export const airingUpdatesRelations = relations(airingupdates, ({ one }) => ({
    anime: one(anime, {
        fields: [airingupdates.alid],
        references: [anime.alid],
    }),
}));

export const watchinganimeRelations = relations(watchinganime, ({ one }) => ({
    user: one(users, {
        fields: [watchinganime.userid],
        references: [users.userid],
    }),
}));

export const completedanimeRelations = relations(completedanime, ({ one }) => ({
    user: one(users, {
        fields: [completedanime.userid],
        references: [users.userid],
    }),
}));

export const configRelations = relations(config, ({ one }) => ({
    user: one(users, {
        fields: [config.userid],
        references: [users.userid],
    }),
}));

// Export types for use in the application
export type Anime = typeof anime.$inferSelect;
export type NewAnime = typeof anime.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CompletedAnime = typeof completedanime.$inferSelect;
export type NewCompletedAnime = typeof completedanime.$inferInsert;
export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type Syncupd = typeof syncupd.$inferSelect;
export type NewSyncupd = typeof syncupd.$inferInsert;
export type WatchedEpAnime = typeof watchedepanime.$inferSelect;
export type NewWatchedEpAnime = typeof watchedepanime.$inferInsert;
export type Watchlist = typeof watchlists.$inferSelect;
export type NewWatchlist = typeof watchlists.$inferInsert;
export type AiringUpdate = typeof airingupdates.$inferSelect;
export type NewAiringUpdate = typeof airingupdates.$inferInsert;
export type WatchingAnime = typeof watchinganime.$inferSelect;
export type NewWatchingAnime = typeof watchinganime.$inferInsert;
