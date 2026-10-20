"""Portable account data. Passwords, tokens and login IDs never leave the database."""
import hashlib
import json
import os
import re
from contextlib import contextmanager

DEFAULT_PREFERENCES = {"dark_mode": "dark", "player_style": "youtube", "default_home": "Subscriptions",
                       "local": True, "autoplay": False}


@contextmanager
def account():
    import psycopg
    with psycopg.connect(host=os.environ.get('PGHOST', 'invidious-db'), dbname='invidious',
                         user='kemal', password=os.environ['DB_PASSWORD'], connect_timeout=5) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT u.email FROM users u JOIN session_ids s ON lower(s.email)=lower(u.email) WHERE s.id=%s",
                        (os.environ['AUTO_SESSION_ID'],))
            row = cur.fetchone()
            if not row:
                raise ValueError('Local account unavailable.')
            yield cur, row[0]


def export_account(cur, email):
    cur.execute("SELECT subscriptions, watched, preferences FROM users WHERE email=%s FOR UPDATE", (email,))
    subscriptions, watched, preferences = cur.fetchone()
    cur.execute("SELECT to_jsonb(p)-'author' FROM playlists p WHERE author=%s ORDER BY created,id", (email,))
    playlists = [row[0] for row in cur.fetchall()]
    cur.execute("SELECT to_jsonb(v) FROM playlist_videos v JOIN playlists p ON p.id=v.plid WHERE p.author=%s ORDER BY v.plid,v.index", (email,))
    videos = [row[0] for row in cur.fetchall()]
    # Upstream uses random Int64 positions: JSON numbers would lose bits in a browser.
    for row in playlists:
        row['index'] = [str(index) for index in row['index']]
    for row in videos:
        row['index'] = str(row['index'])
    return {"subscriptions": subscriptions or [], "watched": watched or [],
            "preferences": json.loads(preferences or '{}'), "playlists": playlists,
            "playlist_videos": videos}


def validate_account(data):
    if not isinstance(data, dict) or set(data) != {'subscriptions', 'watched', 'preferences', 'playlists', 'playlist_videos'}:
        raise ValueError('Invalid account data.')
    for key, pattern in [('subscriptions', r'UC[\w-]{22}'), ('watched', r'[\w-]{11}')]:
        if not isinstance(data[key], list) or len(data[key]) > 200000 or any(not isinstance(v, str) or not re.fullmatch(pattern, v) for v in data[key]):
            raise ValueError('Invalid ' + key + '.')
    prefs = data['preferences']
    if not isinstance(prefs, dict) or len(json.dumps(prefs)) > 100000:
        raise ValueError('Invalid preferences.')
    boolean = {'annotations','annotations_subscribed','preload','autoplay','automatic_instance_redirect','continue',
               'continue_autoplay','latest_only','listen','local','watch_history','vr_mode','show_nick','notifications_only',
               'related_videos','thin_mode','unseen_only','video_loop','extend_desc','save_player_pos','search_privacy'}
    strings = {'dark_mode','locale','region','player_style','quality','quality_dash','default_home','sort','default_playlist'}
    numbers = {'max_results','volume','speed'}
    arrays = {'captions','comments','feed_menu'}
    for key, value in prefs.items():
        if key in boolean and type(value) is bool:
            continue
        if key in strings and (isinstance(value, str) or (key in {'region','default_home','default_playlist'} and value is None)):
            continue
        if key in numbers and type(value) in (int, float) and -100000 <= value <= 100000:
            continue
        if key in arrays and isinstance(value, list) and all(isinstance(v, str) for v in value):
            continue
        raise ValueError('Unsupported preference: ' + key)
    if not isinstance(data['playlists'], list) or not isinstance(data['playlist_videos'], list):
        raise ValueError('Invalid playlists.')
    ids = set()
    for row in data['playlists']:
        if not isinstance(row, dict) or set(row) != {'title','id','description','video_count','created','updated','privacy','index'}:
            raise ValueError('Invalid playlist.')
        if not isinstance(row['id'], str) or not re.fullmatch(r'IVPL[\w-]{31}', row['id']) or row['id'] in ids:
            raise ValueError('Invalid playlist ID.')
        ids.add(row['id'])
        if row['privacy'] not in ['Private', 'Public', 'Unlisted'] or not isinstance(row['index'], list):
            raise ValueError('Invalid playlist settings.')
    def valid_index(value):
        return isinstance(value, str) and re.fullmatch(r'-?(?:0|[1-9][0-9]{0,18})', value) and -(1 << 63) <= int(value) < (1 << 63)
    positions = set()
    for row in data['playlist_videos']:
        if not isinstance(row, dict) or set(row) != {'title','id','author','ucid','length_seconds','published','plid','index','live_now'}:
            raise ValueError('Invalid playlist video.')
        if row['plid'] not in ids or not valid_index(row['index']):
            raise ValueError('Invalid playlist reference.')
        key = (row['plid'], row['index'])
        if key in positions:
            raise ValueError('Duplicate playlist video.')
        positions.add(key)
    for row in data['playlists']:
        if any(not valid_index(i) or (row['id'], i) not in positions for i in row['index']) or len(set(row['index'])) != len(row['index']):
            raise ValueError('Invalid playlist order.')
        if row['video_count'] != len(row['index']):
            raise ValueError('Invalid playlist count.')
    return data


def empty_account():
    return {'subscriptions': [], 'watched': [], 'preferences': dict(DEFAULT_PREFERENCES), 'playlists': [], 'playlist_videos': []}


def replace_account(cur, email, data):
    from psycopg import sql
    from psycopg.types.json import Jsonb
    validate_account(data)
    # All native row casts and writes are inside the same database transaction.
    for row in data['playlists']:
        cur.execute("SELECT author FROM playlists WHERE id=%s", (row['id'],))
        existing = cur.fetchone()
        if existing and existing[0] != email:
            raise ValueError('A playlist ID belongs to another account.')
        cur.execute("SELECT * FROM jsonb_populate_record(NULL::playlists,%s)", (Jsonb({**row, 'author': email}),))
    for row in data['playlist_videos']:
        cur.execute("SELECT * FROM jsonb_populate_record(NULL::playlist_videos,%s)", (Jsonb(row),))
    cur.execute("DELETE FROM playlist_videos WHERE plid IN (SELECT id FROM playlists WHERE author=%s)", (email,))
    cur.execute("DELETE FROM playlists WHERE author=%s", (email,))
    for row in data['playlists']:
        cur.execute("INSERT INTO playlists SELECT * FROM jsonb_populate_record(NULL::playlists,%s)", (Jsonb({**row, 'author': email}),))
    for row in data['playlist_videos']:
        cur.execute("INSERT INTO playlist_videos SELECT * FROM jsonb_populate_record(NULL::playlist_videos,%s)", (Jsonb(row),))
    cur.execute("UPDATE users SET subscriptions=%s,watched=%s,preferences=%s,notifications='{}',feed_needs_update=true,updated=now() WHERE email=%s",
                (data['subscriptions'], data['watched'], json.dumps(data['preferences']), email))
    view = 'subscriptions_' + hashlib.sha256(email.encode()).hexdigest()
    cur.execute(sql.SQL("REFRESH MATERIALIZED VIEW {}").format(sql.Identifier(view)))
