# Architecture Cloud Design
<img src="https://github.com/SandyAryadika/Ifishy-C242-PS164/blob/main/CloudComputing/Architecture%20Ifishy.png" alt="Ifishy architecture">
<br>
The architecture of IFISHY involves:

- Cloud Run: Handles the backend API. Fish disease prediction runs on-device in the mobile app.
- Cloud SQL: Manages relational database operations.
- Cloudflare R2: Stores user images (avatars, post images, scan images) in a public bucket.
- Artifact Registry: Manages Docker container images.
- Logging: Centralized monitoring through structured application logs.

# [Google Cloud Price Outlook Preview](https://cloud.google.com/products/calculator/estimate-preview/CiQwZjU5NWZkNS00OTY4LTRjYTEtYmYwZi1iYjdkYWZjNjVjNTAQAg==?hl=en)
The Google Cloud Estimated Price Preview outlines the services utilized for this project. Artifact Registry is employed for managing container images, specifically for inter-region egress and storage. Cloud Run is used for deploying the Backend API, leveraging scalable CPU and memory allocation to handle API requests efficiently.

Cloud SQL (MySQL) serves as the primary database, operating regionally in Jakarta with a micro-instance and zonal standard storage to manage user and application data. Image assets are stored in Cloudflare R2 and served through a public custom domain.

# [Ifishy API Endpoints Documentation](https://docs.google.com/spreadsheets/d/1AnR8ifyktgZRyspRoGS_CgjIDOoaJQElb6PeBWj_5q8/edit?gid=0#gid=0)
This API supports user management, community interaction, and article access. This README is authoritative for the current R2 upload flow; update the linked spreadsheet separately if it still describes multipart uploads.

- `/dashboard/:email` and `/profile/:email` expose user data.
- `PUT /update` and `DELETE /delete` require a Bearer token.
- Profile photos are attached through `POST /upload-photo` or `PUT /update-photo-profile` using an existing `imageKey`.
- Community posts, comments, replies, votes, shares, and bookmarks are available under `/community`, `/comments`, and `/bookmark`.
- `/articles` and `/articles/:id` expose articles; `/article/scrape/:url` requires a Bearer token and only accepts public `http(s)` URLs (private, loopback, link-local, and metadata addresses are rejected).
- `POST /scan-history` saves a scan, while `GET /scan-history/:userId` requires a token and only returns the caller's own history. An empty history returns `200` with `data: []`.
- All resource IDs are UUID strings (`CHAR(36)`), including users, posts, comments, replies, bookmarks, articles, and scan history. Path and body IDs must be valid UUIDs; invalid IDs return `400` or `404`.
- The backend does not expose `/predict`; prediction and image compression are handled on-device by the mobile app.

## Image Upload Flow
The backend does not accept multipart image uploads. Images are uploaded directly to Cloudflare R2 with a presigned URL:

1. `POST /api/auth/uploads/presign` with `{ purpose, contentType, size }`.
2. Upload the file bytes with HTTP `PUT` to the returned `uploadUrl`, sending the returned `Content-Type` header.
3. `POST /api/auth/uploads/complete` with `{ key }` to verify the object exists, its size/type are allowed, and its magic bytes match the declared image type.
4. Attach the returned `key` as `imageKey` on the target endpoint (avatar, post, or scan).

Upload policies:

| Purpose | Prefix | Max size | Content types |
| --- | --- | --- | --- |
| `avatar` | `avatars/{userId}/` | 5 MB | JPEG, PNG, WebP |
| `post` | `posts/{userId}/` | 10 MB | JPEG, PNG, WebP |
| `scan` | `scans/{userId}/` | 15 MB | JPEG, PNG, WebP |

Object keys use the format `{prefix}/{userId}/{uuid}.{ext}`, where `{userId}` is the user's UUID and `{uuid}` is a server-generated UUID. Uploaded images are public and served from `R2_PUBLIC_BASE_URL`. Upload IDs and keys are not secrets. There is no per-user upload quota; clients should compress images before requesting a presigned URL. Mobile clients must treat all IDs as strings, not integers.

`DELETE /api/auth/uploads` removes an unattached upload. It returns `409 CONFLICT` when the key is still referenced by a profile photo, post, or scan. Replacing a profile photo or post image deletes the old object immediately, and deleting an account removes all of its objects; the cleanup script is only for orphaned objects left by interrupted operations.

# Technology Stack
IFISHY utilizes a robust and modern tech stack for its development and deployment:

### Backend
- Node.js: The core runtime environment for backend development.
- Express.js: A lightweight framework for routing and middleware.
- Prisma: ORM and migration tool for MySQL.
- Cloudflare R2: S3-compatible object storage for user images.
- Redis: Cache and distributed rate limiting (falls back to in-memory limits when unset).
- jose: JWT signing and verification.
- bcrypt: Password hashing.
- Zod: Request validation.
- Puppeteer: Headless browser used by the article scraping endpoint.
- Pino: Structured logging.

### Google Cloud Platform (GCP)
- Cloud Run: To deploy containerized backend APIs.
- Cloud SQL (MySQL): For relational database operations.
- Cloud SQL Connector: To securely connect to MySQL instances.
- Artifact Registry: To store backend container images.

# Running Locally
Prerequisites: Node.js 22+, MySQL, and (optionally) Redis. R2 is required only for upload-related endpoints.

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file based on `.env.example`. The minimum required values are `JWT_SECRET` and `DATABASE_URL`.

```env
PORT=9080
JWT_SECRET=change-me
DATABASE_URL=mysql://user:password@127.0.0.1:3307/ifishy
REDIS_URL=redis://127.0.0.1:6399
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=info
R2_ACCOUNT_ID=change-me
R2_ACCESS_KEY_ID=change-me
R2_SECRET_ACCESS_KEY=change-me
R2_BUCKET_PUBLIC=ifishy
R2_PUBLIC_BASE_URL=https://media.example.com
```

### Step 3: Prepare the Database
```bash
npx prisma generate
npm run prisma:deploy
npm run db:seed
```

The seed is idempotent and only inserts the three starter articles when the articles table is empty.

### Step 4: Run the Application
```bash
npm run dev:node
```

The API listens on `PORT` (default `8080`; the local `.env.example` uses `9080`). Verify it with:

```bash
curl http://localhost:9080/
curl http://localhost:9080/api/articles
```

### Step 5: Run Tests
```bash
npm test
npm run lint
```

# Storage Maintenance
### Backfill legacy `/uploads`
Legacy database values such as `/uploads/image-post/foo.png` can be migrated to R2 from a local directory:

```bash
npm run storage:backfill -- --source=/path/to/uploads
npm run storage:backfill -- --source=/path/to/uploads --apply
```

The script is a dry run by default. It validates image signatures, uploads valid files, and rewrites `users.profile_photo`, `posts.image_url`, and `scan_history.fish_image`.

### Remove orphaned objects
Objects that are not referenced by the database can be removed after a grace period:

```bash
npm run storage:cleanup
npm run storage:cleanup -- --apply
npm run storage:cleanup -- --older-than-hours=48 --apply
```

The default is a 24-hour dry run. Attached objects are never deleted by the script.

### Legacy static files
The backend no longer serves `/uploads`; all images must be served from R2 through `R2_PUBLIC_BASE_URL`. Keep `R2_PUBLIC_BASE_URL` pointed at the custom domain bound to the bucket.

# Deployment Process to Cloud Run via Docker and Artifact Registry
### Step 1: Build the Image
```bash
docker build -t ifishy-backend .
```

### Step 2: Push to Artifact Registry
```bash
docker tag ifishy-backend REGION-docker.pkg.dev/PROJECT-ID/REPOSITORY/ifishy-backend
docker push REGION-docker.pkg.dev/PROJECT-ID/REPOSITORY/ifishy-backend
```

### Step 3: Deploy to Cloud Run
```bash
gcloud run deploy ifishy-backend \
  --image REGION-docker.pkg.dev/PROJECT-ID/REPOSITORY/ifishy-backend \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated
```

Configure the same environment variables in Cloud Run. For Cloud SQL, connect the instance and use the appropriate `DATABASE_URL` (including the Cloud SQL socket path when applicable).

### Step 4: Apply Migrations
```bash
npm run prisma:deploy
npm run db:seed
```

### Step 5: Test and Monitor
1. Access the application through the Cloud Run URL.
2. Use Google Cloud Logging for centralized logs and troubleshooting.

# Environment Variables
- `PORT`: HTTP port. Default `8080`.
- `JWT_SECRET`: Secret used to sign and verify JWT access tokens. Required.
- `DATABASE_URL`: Prisma MySQL connection string. Required.
- `REDIS_URL`: Optional Redis connection string for cache and distributed rate limiting.
- `CORS_ORIGINS`: Comma-separated browser origins. When empty, all origins are allowed and a warning is logged.
- `LOG_LEVEL`: Pino log level. Default `info`.
- `R2_ACCOUNT_ID`: Cloudflare account ID.
- `R2_ACCESS_KEY_ID`: R2 access key ID.
- `R2_SECRET_ACCESS_KEY`: R2 secret access key.
- `R2_BUCKET_PUBLIC`: R2 bucket used for all public uploads.
- `R2_PUBLIC_BASE_URL`: Public custom domain for the bucket (for example `https://media.example.com`).

# Operational Notes
- All image endpoints validate ownership of the object key against the authenticated user.
- `POST /api/auth/uploads/presign` is limited to 30 requests per minute per IP; the global API limiter allows 300 requests per minute.
- Access tokens are sent as `Authorization: Bearer <token>`.
- Scan history is private: a user can only read their own history.
- Replacing a profile photo or post image deletes the previous R2 object. Deleting an account removes all objects under the user's avatar, post, and scan prefixes.
