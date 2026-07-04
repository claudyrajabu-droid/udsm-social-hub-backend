// ============================================================
//  DATABASE MODELS — Sequelize ORM + PostgreSQL
//  Tables: users, posts, comments, likes, polls, poll_options,
//          poll_votes, messages, groups, group_members,
//          notifications, follows, courses, announcements
// ============================================================
const { Sequelize, DataTypes, Op } = require('sequelize');
const logger = require('../utils/logger');

// ── Connection ───────────────────────────────────────────────
// Kwa Neon (na mitandao inayozuia port 5432 moja kwa moja, kama
// baadhi ya mitandao ya simu), tunatumia @neondatabase/serverless
// kama dialectModule — inatumia WebSocket/HTTPS badala ya TCP ya moja kwa moja.
const isNeon = (process.env.DATABASE_URL || '').includes('neon.tech');

let dialectModule;
if (isNeon) {
  const neonServerless = require('@neondatabase/serverless');
  neonServerless.neonConfig.webSocketConstructor = require('ws');
  dialectModule = neonServerless;
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  ...(dialectModule ? { dialectModule } : {}),
  logging: process.env.NODE_ENV === 'development'
    ? (msg) => logger.debug(msg) : false,
  pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  dialectOptions: (process.env.NODE_ENV === 'production' || isNeon)
    ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  define: { underscored: true, timestamps: true },
});

// ════════════════════════════════════════════════════════════
//  MODELS
// ════════════════════════════════════════════════════════════

// ── USER ─────────────────────────────────────────────────────
const User = sequelize.define('User', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:        { type: DataTypes.STRING(100), allowNull: false, validate: { len: [2, 100] } },
  email:       { type: DataTypes.STRING(255), allowNull: false, unique: true,
                 validate: { isEmail: true }, set(v) { this.setDataValue('email', v.toLowerCase()); } },
  password:    { type: DataTypes.STRING(255), allowNull: false },
  role:        { type: DataTypes.ENUM('student','teacher','admin'), defaultValue: 'student' },
  studentId:   { type: DataTypes.STRING(20) },
  department:  { type: DataTypes.STRING(100) },
  yearOfStudy: { type: DataTypes.INTEGER, validate: { min: 1, max: 7 } },
  avatarUrl:   { type: DataTypes.TEXT },
  coverUrl:    { type: DataTypes.TEXT },
  bio:         { type: DataTypes.TEXT(500) },
  phone:       { type: DataTypes.STRING(20) },
  fcmToken:    { type: DataTypes.TEXT },      // Firebase push notification token
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true },
  isVerified:  { type: DataTypes.BOOLEAN, defaultValue: false },
  lastSeen:    { type: DataTypes.DATE },
  followersCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  followingCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  postsCount:     { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'users',
  defaultScope: { attributes: { exclude: ['password', 'fcmToken'] } },
  scopes: { withPassword: { attributes: {} } },
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['department'] },
  ]
});

// ── POST ─────────────────────────────────────────────────────
const Post = sequelize.define('Post', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:        { type: DataTypes.UUID, allowNull: false },
  content:       { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, 2000] } },
  imageUrls:     { type: DataTypes.ARRAY(DataTypes.TEXT), defaultValue: [] },
  videoUrl:      { type: DataTypes.TEXT },
  hashtags:      { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  likesCount:    { type: DataTypes.INTEGER, defaultValue: 0 },
  commentsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  sharesCount:   { type: DataTypes.INTEGER, defaultValue: 0 },
  visibility:    { type: DataTypes.ENUM('public','friends','private'), defaultValue: 'public' },
  isPinned:      { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'posts',
  indexes: [{ fields: ['user_id'] }, { fields: ['created_at'] }]
});

// ── COMMENT ──────────────────────────────────────────────────
const Comment = sequelize.define('Comment', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  postId:   { type: DataTypes.UUID, allowNull: false },
  userId:   { type: DataTypes.UUID, allowNull: false },
  parentId: { type: DataTypes.UUID },  // kwa replies
  content:  { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, 500] } },
  likesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'comments' });

// ── LIKE ─────────────────────────────────────────────────────
const Like = sequelize.define('Like', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:   { type: DataTypes.UUID, allowNull: false },
  postId:   { type: DataTypes.UUID },
  commentId:{ type: DataTypes.UUID },
}, {
  tableName: 'likes',
  indexes: [{ unique: true, fields: ['user_id', 'post_id'] }]
});

// ── POLL ─────────────────────────────────────────────────────
const Poll = sequelize.define('Poll', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:     { type: DataTypes.UUID, allowNull: false },
  question:   { type: DataTypes.STRING(500), allowNull: false },
  description:{ type: DataTypes.TEXT },
  endsAt:     { type: DataTypes.DATE },
  totalVotes: { type: DataTypes.INTEGER, defaultValue: 0 },
  isAnonymous:{ type: DataTypes.BOOLEAN, defaultValue: false },
  isActive:   { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'polls' });

// ── POLL OPTION ───────────────────────────────────────────────
const PollOption = sequelize.define('PollOption', {
  id:     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pollId: { type: DataTypes.UUID, allowNull: false },
  label:  { type: DataTypes.STRING(200), allowNull: false },
  votes:  { type: DataTypes.INTEGER, defaultValue: 0 },
  order:  { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'poll_options' });

// ── POLL VOTE ─────────────────────────────────────────────────
const PollVote = sequelize.define('PollVote', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pollId:   { type: DataTypes.UUID, allowNull: false },
  optionId: { type: DataTypes.UUID, allowNull: false },
  userId:   { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'poll_votes',
  indexes:   [{ unique: true, fields: ['poll_id', 'user_id'] }]
});

// ── MESSAGE ───────────────────────────────────────────────────
const Message = sequelize.define('Message', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  senderId:   { type: DataTypes.UUID, allowNull: false },
  receiverId: { type: DataTypes.UUID, allowNull: false },
  content:    { type: DataTypes.TEXT, allowNull: false },
  mediaUrl:   { type: DataTypes.TEXT },
  mediaType:  { type: DataTypes.ENUM('image','video','file') },
  readAt:     { type: DataTypes.DATE },
  deletedAt:  { type: DataTypes.DATE },
}, {
  tableName: 'messages',
  indexes:   [{ fields: ['sender_id', 'receiver_id'] }, { fields: ['created_at'] }]
});

// ── GROUP ─────────────────────────────────────────────────────
const Group = sequelize.define('Group', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:        { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT },
  creatorId:   { type: DataTypes.UUID, allowNull: false },
  avatarUrl:   { type: DataTypes.TEXT },
  coverUrl:    { type: DataTypes.TEXT },
  memberCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  isPrivate:   { type: DataTypes.BOOLEAN, defaultValue: false },
  department:  { type: DataTypes.STRING(100) },
  category:    { type: DataTypes.STRING(50) }, // academic, social, sport
}, { tableName: 'groups' });

// ── GROUP MEMBER ──────────────────────────────────────────────
const GroupMember = sequelize.define('GroupMember', {
  id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  groupId: { type: DataTypes.UUID, allowNull: false },
  userId:  { type: DataTypes.UUID, allowNull: false },
  role:    { type: DataTypes.ENUM('admin','moderator','member'), defaultValue: 'member' },
  joinedAt:{ type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'group_members',
  indexes:   [{ unique: true, fields: ['group_id', 'user_id'] }]
});

// ── FOLLOW ────────────────────────────────────────────────────
const Follow = sequelize.define('Follow', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  followerId:  { type: DataTypes.UUID, allowNull: false },
  followingId: { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'follows',
  indexes:   [{ unique: true, fields: ['follower_id', 'following_id'] }]
});

// ── NOTIFICATION ──────────────────────────────────────────────
const Notification = sequelize.define('Notification', {
  id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:  { type: DataTypes.UUID, allowNull: false },   // aliyepokea
  actorId: { type: DataTypes.UUID },                     // aliyetuma
  type:    { type: DataTypes.STRING(50), allowNull: false }, // like,comment,follow,poll,mention
  title:   { type: DataTypes.STRING(200) },
  body:    { type: DataTypes.TEXT },
  refId:   { type: DataTypes.UUID },    // post/poll/message id
  refType: { type: DataTypes.STRING(50) },
  isRead:  { type: DataTypes.BOOLEAN, defaultValue: false },
  sentAt:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'notifications',
  indexes:   [{ fields: ['user_id', 'is_read'] }]
});

// ── COURSE ───────────────────────────────────────────────────
const Course = sequelize.define('Course', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:        { type: DataTypes.STRING(200), allowNull: false },
  code:        { type: DataTypes.STRING(20), allowNull: false },
  description: { type: DataTypes.TEXT },
  teacherId:   { type: DataTypes.UUID, allowNull: false },
  department:  { type: DataTypes.STRING(100) },
  year:        { type: DataTypes.INTEGER },
  semester:    { type: DataTypes.INTEGER },
  studentsCount:{ type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'courses' });

// ── ANNOUNCEMENT ──────────────────────────────────────────────
const Announcement = sequelize.define('Announcement', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title:     { type: DataTypes.STRING(300), allowNull: false },
  content:   { type: DataTypes.TEXT, allowNull: false },
  authorId:  { type: DataTypes.UUID, allowNull: false },
  courseId:  { type: DataTypes.UUID },
  groupId:   { type: DataTypes.UUID },
  priority:  { type: DataTypes.ENUM('low','normal','high','urgent'), defaultValue: 'normal' },
  expiresAt: { type: DataTypes.DATE },
  viewsCount:{ type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'announcements' });

// ── REPORT ───────────────────────────────────────────────────
const Report = sequelize.define('Report', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reporterId:{ type: DataTypes.UUID, allowNull: false },
  refId:    { type: DataTypes.UUID, allowNull: false },
  refType:  { type: DataTypes.STRING(50) },  // post, user, comment
  reason:   { type: DataTypes.STRING(200) },
  details:  { type: DataTypes.TEXT },
  status:   { type: DataTypes.ENUM('pending','reviewed','resolved'), defaultValue: 'pending' },
  resolvedBy:{ type: DataTypes.UUID },
}, { tableName: 'reports' });

// ════════════════════════════════════════════════════════════
//  ASSOCIATIONS (Relationships)
// ════════════════════════════════════════════════════════════

// User ↔ Post
User.hasMany(Post,         { foreignKey: 'user_id', as: 'posts',     onDelete: 'CASCADE' });
Post.belongsTo(User,       { foreignKey: 'user_id', as: 'author' });

// Post ↔ Comment
Post.hasMany(Comment,      { foreignKey: 'post_id', as: 'comments',  onDelete: 'CASCADE' });
Comment.belongsTo(Post,    { foreignKey: 'post_id', as: 'post' });
Comment.belongsTo(User,    { foreignKey: 'user_id', as: 'author' });
Comment.hasMany(Comment,   { foreignKey: 'parent_id', as: 'replies' });

// Post ↔ Like
Post.hasMany(Like,         { foreignKey: 'post_id', as: 'likes',     onDelete: 'CASCADE' });
Like.belongsTo(User,       { foreignKey: 'user_id', as: 'user' });
Like.belongsTo(Post,       { foreignKey: 'post_id', as: 'post' });

// Poll ↔ PollOption ↔ PollVote
Poll.belongsTo(User,       { foreignKey: 'user_id', as: 'creator' });
Poll.hasMany(PollOption,   { foreignKey: 'poll_id', as: 'options',   onDelete: 'CASCADE' });
Poll.hasMany(PollVote,     { foreignKey: 'poll_id', as: 'votes',     onDelete: 'CASCADE' });
PollOption.hasMany(PollVote,{ foreignKey: 'option_id', as: 'voteRecords' });
PollVote.belongsTo(User,   { foreignKey: 'user_id', as: 'voter' });

// Message
Message.belongsTo(User,    { foreignKey: 'sender_id',   as: 'sender' });
Message.belongsTo(User,    { foreignKey: 'receiver_id', as: 'receiver' });

// Group ↔ GroupMember
Group.hasMany(GroupMember, { foreignKey: 'group_id', as: 'members', onDelete: 'CASCADE' });
Group.belongsTo(User,      { foreignKey: 'creator_id', as: 'creator' });
GroupMember.belongsTo(User,{ foreignKey: 'user_id', as: 'user' });
GroupMember.belongsTo(Group,{ foreignKey: 'group_id', as: 'group' });
User.belongsToMany(Group,  { through: GroupMember, foreignKey: 'user_id', as: 'groups' });

// Follow
User.hasMany(Follow,       { foreignKey: 'follower_id',  as: 'following' });
User.hasMany(Follow,       { foreignKey: 'following_id', as: 'followers' });
Follow.belongsTo(User,     { foreignKey: 'follower_id',  as: 'follower' });
Follow.belongsTo(User,     { foreignKey: 'following_id', as: 'followee' });

// Notification
User.hasMany(Notification, { foreignKey: 'user_id',  as: 'notifications' });
User.hasMany(Notification, { foreignKey: 'actor_id', as: 'sentNotifications' });
Notification.belongsTo(User,{ foreignKey: 'actor_id', as: 'actor' });

// Course
Course.belongsTo(User,     { foreignKey: 'teacher_id', as: 'teacher' });
User.hasMany(Course,       { foreignKey: 'teacher_id', as: 'courses' });

// Announcement
Announcement.belongsTo(User,{ foreignKey: 'author_id', as: 'author' });

// Report
Report.belongsTo(User,     { foreignKey: 'reporter_id',   as: 'reporter' });
Report.belongsTo(User,     { foreignKey: 'resolved_by',   as: 'resolver' });

// ════════════════════════════════════════════════════════════
//  SYNC
// ════════════════════════════════════════════════════════════
const syncDatabase = async () => {
  await sequelize.authenticate();
  logger.info('✅ PostgreSQL imeunganika');
  await sequelize.sync({
    alter: process.env.NODE_ENV === 'development',
    force: false,  // KAMWE usitumie force:true kwenye production
  });
  logger.info('✅ Tables ziko tayari');
};

module.exports = {
  sequelize, syncDatabase, Op,
  User, Post, Comment, Like,
  Poll, PollOption, PollVote,
  Message, Group, GroupMember,
  Follow, Notification,
  Course, Announcement, Report,
};
