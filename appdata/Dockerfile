FROM python:3.13-alpine
WORKDIR /app
RUN pip install --no-cache-dir "psycopg[binary]==3.2.10"
COPY store.py account_data.py ./
# /data is the appdata volume; created here so the volume starts owned by the app's user.
RUN mkdir -p /data && chown nobody:nobody /data
USER nobody
CMD ["python", "store.py"]
