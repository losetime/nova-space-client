import {
  pgEnum,
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  doublePrecision,
  json,
  jsonb,
  serial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============ Enums ============

export const userRole = pgEnum('user_role', ['user', 'admin', 'super_admin']);
export const userLevel = pgEnum('user_level', [
  'basic',
  'advanced',
  'professional',
]);

export const subscriptionPlan = pgEnum('subscription_plan', [
  'monthly',
  'quarterly',
  'yearly',
  'lifetime',
  'custom',
]);
export const subscriptionStatus = pgEnum('subscription_status', [
  'active',
  'expired',
  'cancelled',
  'pending',
]);

export const pointsAction = pgEnum('points_action', [
  'register',
  'daily_login',
  'share',
  'invite',
  'task_complete',
  'purchase',
  'consume',
  'admin_grant',
  'expire',
  'points_exchange_member',
]);

export const favoriteType = pgEnum('favorite_type', [
  'satellite',
  'news',
  'education',
  'intelligence',
]);

export const notificationType = pgEnum('notification_type', [
  'intelligence',
  'system',
  'achievement',
  'membership',
]);

export const feedbackType = pgEnum('feedback_type', [
  'bug',
  'feature',
  'suggestion',
  'other',
]);
export const feedbackStatus = pgEnum('feedback_status', [
  'pending',
  'processing',
  'resolved',
  'closed',
]);

export const articleCategory = pgEnum('article_category', [
  'basic',
  'advanced',
  'mission',
  'people',
]);
export const articleType = pgEnum('article_type', ['article', 'video']);

export const quizCategory = pgEnum('quiz_category', [
  'basic',
  'advanced',
  'mission',
  'people',
]);

export const intelligenceCategory = pgEnum('intelligence_category', [
  'launch',
  'satellite',
  'industry',
  'research',
  'environment',
]);
export const intelligenceLevel = pgEnum('intelligence_level', [
  'basic',
  'professional',
]);

export const milestoneCategory = pgEnum('milestone_category', [
  'launch',
  'recovery',
  'orbit',
  'mission',
  'other',
]);

export const pushSubscriptionStatus = pgEnum('push_subscription_status', [
  'active',
  'paused',
  'cancelled',
]);
export const subscriptionType = pgEnum('subscription_type', [
  'space_weather',
  'intelligence',
]);

// ============ Tables ============

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 20 }).unique(),
  password: varchar('password', { length: 255 }).notNull(),
  avatar: varchar('avatar', { length: 500 }),
  nickname: varchar('nickname', { length: 100 }),
  role: userRole('role').notNull().default('user'),
  level: userLevel('level').notNull().default('basic'),
  points: integer('points').notNull().default(0),
  totalPoints: integer('total_points').notNull().default(0),
  isVerified: boolean('is_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  resetPasswordCode: varchar('reset_password_code', { length: 6 }),
  resetPasswordAttempts: integer('reset_password_attempts')
    .notNull()
    .default(0),
  resetPasswordExpiry: timestamp('reset_password_expiry', {
    mode: 'date',
    withTimezone: true,
  }),
  lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
  lastLoginIp: varchar('last_login_ip', { length: 50 }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const registrationCodes = pgTable('registration_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  code: varchar('code', { length: 6 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  usedAt: timestamp('used_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  plan: subscriptionPlan('plan').notNull(),
  status: subscriptionStatus('status').notNull().default('pending'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('CNY'),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  paymentId: varchar('payment_id', { length: 100 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  autoRenew: boolean('auto_renew').notNull().default(false),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  cancelReason: varchar('cancel_reason', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const pointsRecords = pgTable('points_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  action: pointsAction('action').notNull(),
  points: integer('points').notNull(),
  balance: numeric('balance', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  description: varchar('description', { length: 255 }),
  relatedId: varchar('related_id', { length: 100 }),
  relatedType: varchar('related_type', { length: 50 }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const userFavorites = pgTable(
  'user_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetId: varchar('target_id', { length: 100 }).notNull(),
    type: favoriteType('type').notNull(),
    note: varchar('note', { length: 255 }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_favorites_user_target_type_idx').on(
      table.userId,
      table.targetId,
      table.type,
    ),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull().default('system'),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    relatedId: uuid('related_id'),
    relatedType: varchar('related_type', { length: 50 }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_id_is_read_idx').on(table.userId, table.isRead),
    index('notifications_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  type: feedbackType('type').notNull().default('other'),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  status: feedbackStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    subscriptionTypes: text('subscription_types').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    status: pushSubscriptionStatus('status').notNull().default('active'),
    lastPushAt: timestamp('last_push_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('push_subscriptions_user_id_idx').on(table.userId)],
);

export const satelliteTle = pgTable(
  'satellite_tle',
  {
    noradId: varchar('norad_id', { length: 50 }).primaryKey(),
    source: varchar('source', { length: 20 }).notNull().default('celestrak'),
    name: varchar('name', { length: 100 }).notNull(),
    line1: text('line1').notNull(),
    line2: text('line2').notNull(),
    epoch: timestamp('epoch', { mode: 'date' }),
    inclination: doublePrecision('inclination'),
    raan: doublePrecision('raan'),
    eccentricity: doublePrecision('eccentricity'),
    argOfPerigee: doublePrecision('arg_of_perigee'),
    meanMotion: doublePrecision('mean_motion'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('satellite_tle_source_idx').on(table.source),
    index('satellite_tle_updated_at_idx').on(table.updatedAt),
  ],
);

export const satelliteMetadata = pgTable(
  'satellite_metadata',
  {
    noradId: varchar('norad_id', { length: 50 }).primaryKey(),
    name: varchar('name', { length: 200 }),
    objectId: varchar('object_id', { length: 100 }),
    altName: varchar('alt_name', { length: 200 }),
    objectType: varchar('object_type', { length: 100 }),
    status: varchar('status', { length: 10 }),
    countryCode: varchar('country_code', { length: 100 }),
    launchDate: date('launch_date', { mode: 'date' }),
    stableDate: date('stable_date', { mode: 'date' }),
    launchSite: varchar('launch_site', { length: 100 }),
    launchPad: varchar('launch_pad', { length: 100 }),
    launchVehicle: varchar('launch_vehicle', { length: 100 }),
    flightNo: varchar('flight_no', { length: 100 }),
    cosparLaunchNo: varchar('cospar_launch_no', { length: 100 }),
    launchFailure: boolean('launch_failure'),
    launchSiteName: varchar('launch_site_name', { length: 100 }),
    decayDate: date('decay_date', { mode: 'date' }),
    period: doublePrecision('period'),
    inclination: doublePrecision('inclination'),
    apogee: doublePrecision('apogee'),
    perigee: doublePrecision('perigee'),
    eccentricity: doublePrecision('eccentricity'),
    raan: doublePrecision('raan'),
    argOfPerigee: doublePrecision('arg_of_perigee'),
    rcs: varchar('rcs', { length: 100 }),
    stdMag: doublePrecision('std_mag'),
    tleEpoch: timestamp('tle_epoch', { mode: 'date' }),
    tleAge: integer('tle_age'),
    cosparId: varchar('cospar_id', { length: 100 }),
    objectClass: varchar('object_class', { length: 100 }),
    launchMass: doublePrecision('launch_mass'),
    shape: text('shape'),
    dimensions: varchar('dimensions', { length: 100 }),
    span: doublePrecision('span'),
    mission: text('mission'),
    firstEpoch: date('first_epoch', { mode: 'date' }),
    operator: varchar('operator', { length: 100 }),
    manufacturer: varchar('manufacturer', { length: 100 }),
    contractor: varchar('contractor', { length: 100 }),
    bus: varchar('bus', { length: 100 }),
    configuration: varchar('configuration', { length: 100 }),
    purpose: text('purpose'),
    power: text('power'),
    motor: text('motor'),
    length: doublePrecision('length'),
    diameter: doublePrecision('diameter'),
    dryMass: doublePrecision('dry_mass'),
    equipment: text('equipment'),
    adcs: text('adcs'),
    payload: text('payload'),
    constellationName: text('constellation_name'),
    lifetime: text('lifetime'),
    color: text('color'),
    materialComposition: text('material_composition'),
    majorEvents: text('major_events'),
    relatedSatellites: text('related_satellites'),
    transmitterFrequencies: text('transmitter_frequencies'),
    sources: text('sources'),
    referenceUrls: text('reference_urls'),
    summary: text('summary'),
    anomalyFlags: varchar('anomaly_flags', { length: 100 }),
    lastReviewed: timestamp('last_reviewed', { mode: 'date' }),
    predDecayDate: date('pred_decay_date', { mode: 'date' }),
    hasDiscosData: boolean('has_discos_data').notNull().default(false),
    hasKeeptrackData: boolean('has_keeptrack_data').notNull().default(false),
    hasSpacetrackData: boolean('has_spacetrack_data').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('satellite_metadata_country_code_idx').on(table.countryCode),
    index('satellite_metadata_launch_date_idx').on(table.launchDate),
    index('satellite_metadata_object_type_idx').on(table.objectType),
  ],
);

export const educationArticles = pgTable('education_articles', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  cover: varchar('cover', { length: 500 }),
  category: articleCategory('category').notNull().default('basic'),
  type: articleType('type').notNull().default('article'),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  duration: integer('duration'),
  tags: text('tags'),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const educationQuizzes = pgTable('education_quizzes', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  options: json('options').notNull().$type<string[]>(),
  correctIndex: integer('correct_index').notNull(),
  explanation: text('explanation'),
  category: quizCategory('category').notNull().default('basic'),
  points: integer('points').notNull().default(2),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const educationQuizAnswers = pgTable('education_quiz_answers', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  quizId: integer('quiz_id')
    .notNull()
    .references(() => educationQuizzes.id, { onDelete: 'cascade' }),
  selectedIndex: integer('selected_index').notNull(),
  isCorrect: boolean('is_correct').notNull(),
  pointsEarned: integer('points_earned').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const articleLikes = pgTable('article_likes', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  articleId: integer('article_id')
    .notNull()
    .references(() => educationArticles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const educationArticleCollects = pgTable('education_article_collects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  articleId: integer('article_id')
    .notNull()
    .references(() => educationArticles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const intelligences = pgTable('intelligences', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  cover: varchar('cover', { length: 500 }),
  category: intelligenceCategory('category').notNull().default('launch'),
  level: intelligenceLevel('level').notNull().default('basic'),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  collects: integer('collects').notNull().default(0),
  source: varchar('source', { length: 100 }).notNull(),
  sourceUrl: varchar('source_url', { length: 500 }),
  tags: text('tags'),
  analysis: text('analysis'),
  trend: text('trend'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const intelligenceCollects = pgTable('intelligence_collects', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  intelligenceId: integer('intelligence_id')
    .notNull()
    .references(() => intelligences.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const milestones = pgTable(
  'milestones',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    content: text('content'),
    eventDate: date('event_date', { mode: 'string' }).notNull(),
    category: milestoneCategory('category').notNull().default('other'),
    cover: varchar('cover', { length: 500 }),
    media:
      jsonb('media').$type<
        { type: 'image' | 'video'; url: string; caption?: string }[]
      >(),
    relatedSatelliteNoradId: varchar('related_satellite_norad_id', {
      length: 20,
    }),
    importance: integer('importance').notNull().default(1),
    location: varchar('location', { length: 100 }),
    organizer: varchar('organizer', { length: 100 }),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('milestones_event_date_idx').on(table.eventDate)],
);

export const company = pgTable(
  'company',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    country: varchar('country', { length: 50 }),
    foundedYear: integer('founded_year'),
    website: varchar('website', { length: 255 }),
    description: text('description'),
    logoUrl: varchar('logo_url', { length: 500 }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('company_name_idx').on(table.name),
    index('company_country_idx').on(table.country),
  ],
);

export const membershipPlans = pgTable('membership_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  planCode: varchar('plan_code', { length: 50 }).notNull().unique(),
  durationMonths: integer('duration_months').notNull(),
  level: userLevel('level').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  pointsPrice: integer('points_price'),
  description: text('description'),
  features: jsonb('features'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const benefits = pgTable('benefits', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  category: varchar('category', { length: 50 }).default('general'),
  description: varchar('description', { length: 255 }),
  valueType: varchar('value_type', { length: 20 }).default('number'),
  unit: varchar('unit', { length: 50 }),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const memberLevels = pgTable('member_levels', {
  id: varchar('id', { length: 36 }).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  icon: varchar('icon', { length: 10 }),
  isDefault: boolean('is_default').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const levelBenefits = pgTable(
  'level_benefits',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    levelId: varchar('level_id', { length: 36 }).notNull(),
    benefitId: varchar('benefit_id', { length: 36 }).notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    displayText: varchar('display_text', { length: 255 }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('level_benefits_unique_idx').on(table.levelId, table.benefitId),
  ],
);

// ============ Relations ============

export const usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  pointsRecords: many(pointsRecords),
  favorites: many(userFavorites),
  notifications: many(notifications),
  pushSubscriptions: many(pushSubscriptions),
  quizAnswers: many(educationQuizAnswers),
  articleLikes: many(articleLikes),
  articleCollects: many(educationArticleCollects),
  intelligenceCollects: many(intelligenceCollects),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const pointsRecordsRelations = relations(pointsRecords, ({ one }) => ({
  user: one(users, {
    fields: [pointsRecords.userId],
    references: [users.id],
  }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userFavorites.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

export const educationArticlesRelations = relations(
  educationArticles,
  ({ many }) => ({
    likes: many(articleLikes),
    collects: many(educationArticleCollects),
  }),
);

export const educationQuizzesRelations = relations(
  educationQuizzes,
  ({ many }) => ({
    answers: many(educationQuizAnswers),
  }),
);

export const educationQuizAnswersRelations = relations(
  educationQuizAnswers,
  ({ one }) => ({
    user: one(users, {
      fields: [educationQuizAnswers.userId],
      references: [users.id],
    }),
    quiz: one(educationQuizzes, {
      fields: [educationQuizAnswers.quizId],
      references: [educationQuizzes.id],
    }),
  }),
);

export const articleLikesRelations = relations(articleLikes, ({ one }) => ({
  user: one(users, {
    fields: [articleLikes.userId],
    references: [users.id],
  }),
  article: one(educationArticles, {
    fields: [articleLikes.articleId],
    references: [educationArticles.id],
  }),
}));

export const educationArticleCollectsRelations = relations(
  educationArticleCollects,
  ({ one }) => ({
    user: one(users, {
      fields: [educationArticleCollects.userId],
      references: [users.id],
    }),
    article: one(educationArticles, {
      fields: [educationArticleCollects.articleId],
      references: [educationArticles.id],
    }),
  }),
);

export const intelligencesRelations = relations(intelligences, ({ many }) => ({
  collects: many(intelligenceCollects),
}));

export const intelligenceCollectsRelations = relations(
  intelligenceCollects,
  ({ one }) => ({
    user: one(users, {
      fields: [intelligenceCollects.userId],
      references: [users.id],
    }),
    intelligence: one(intelligences, {
      fields: [intelligenceCollects.intelligenceId],
      references: [intelligences.id],
    }),
  }),
);

// ============ Type exports ============

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type PointsRecord = typeof pointsRecords.$inferSelect;
export type NewPointsRecord = typeof pointsRecords.$inferInsert;

export type UserFavorite = typeof userFavorites.$inferSelect;
export type NewUserFavorite = typeof userFavorites.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

export type SatelliteTle = typeof satelliteTle.$inferSelect;
export type NewSatelliteTle = typeof satelliteTle.$inferInsert;

export type SatelliteMetadata = typeof satelliteMetadata.$inferSelect;
export type NewSatelliteMetadata = typeof satelliteMetadata.$inferInsert;

export type Article = typeof educationArticles.$inferSelect;
export type NewArticle = typeof educationArticles.$inferInsert;

export type Quiz = typeof educationQuizzes.$inferSelect;
export type NewQuiz = typeof educationQuizzes.$inferInsert;

export type QuizAnswer = typeof educationQuizAnswers.$inferSelect;
export type NewQuizAnswer = typeof educationQuizAnswers.$inferInsert;

export type ArticleLike = typeof articleLikes.$inferSelect;
export type NewArticleLike = typeof articleLikes.$inferInsert;

export type ArticleCollect = typeof educationArticleCollects.$inferSelect;
export type NewArticleCollect = typeof educationArticleCollects.$inferInsert;

export type Intelligence = typeof intelligences.$inferSelect;
export type NewIntelligence = typeof intelligences.$inferInsert;

export type IntelligenceCollect = typeof intelligenceCollects.$inferSelect;
export type NewIntelligenceCollect = typeof intelligenceCollects.$inferInsert;

export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;

export type Company = typeof company.$inferSelect;
export type NewCompany = typeof company.$inferInsert;

export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type NewMembershipPlan = typeof membershipPlans.$inferInsert;
export type Benefit = typeof benefits.$inferSelect;
export type NewBenefit = typeof benefits.$inferInsert;
export type MemberLevel = typeof memberLevels.$inferSelect;
export type NewMemberLevel = typeof memberLevels.$inferInsert;
export type LevelBenefit = typeof levelBenefits.$inferSelect;
export type NewLevelBenefit = typeof levelBenefits.$inferInsert;
