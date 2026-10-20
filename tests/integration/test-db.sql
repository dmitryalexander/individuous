CREATE EXTENSION IF NOT EXISTS pgcrypto;
\i /schema/users.sql
\i /schema/session_ids.sql
\i /schema/playlists.sql
\i /schema/playlist_videos.sql
CREATE TABLE channel_videos (id text, ucid text, published timestamptz);
INSERT INTO users(updated,notifications,subscriptions,email,preferences,password,token,watched,feed_needs_update)
VALUES(now(),'{}','{}','test@local','{}','synthetic-password','synthetic-token','{}',true);
INSERT INTO session_ids VALUES('synthetic-test-session','test@local',now());
SELECT format('CREATE MATERIALIZED VIEW %I AS SELECT cv.* FROM channel_videos cv WHERE EXISTS (SELECT subscriptions FROM users u WHERE cv.ucid=ANY(u.subscriptions) AND u.email=%L)', 'subscriptions_'||encode(digest('test@local','sha256'),'hex'),'test@local') \gexec
