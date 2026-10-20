-- Reuse the account already attached to this installation's session.
-- Only a new installation receives the empty default account.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO users (updated, notifications, subscriptions, email, preferences, password, token, watched, feed_needs_update)
SELECT now(), '{}', '{}', 'local@individuous.local',
  '{"dark_mode":"dark","player_style":"youtube","default_home":"Subscriptions","local":true,"autoplay":false}',
  crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)),
  encode(gen_random_bytes(32), 'hex'), '{}', true
WHERE NOT EXISTS (SELECT 1 FROM session_ids WHERE id = :'sid')
ON CONFLICT (email) DO NOTHING;
INSERT INTO session_ids (id, email, issued)
VALUES (:'sid', 'local@individuous.local', now())
ON CONFLICT (id) DO NOTHING;
SELECT format('CREATE MATERIALIZED VIEW IF NOT EXISTS %I AS SELECT cv.* FROM channel_videos cv WHERE EXISTS (SELECT subscriptions FROM users u WHERE cv.ucid = ANY(u.subscriptions) AND u.email = %L) ORDER BY published DESC',
  'subscriptions_' || encode(digest(email, 'sha256'), 'hex'), email)
FROM session_ids WHERE id = :'sid' \gexec
COMMIT;
