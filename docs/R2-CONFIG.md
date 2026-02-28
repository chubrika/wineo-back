# Cloudflare R2 configuration for product image uploads

This document describes how to configure Cloudflare R2 for the Wineo product image upload flow: presigned uploads to a temp folder, then move + resize on product creation, with lifecycle rules to delete abandoned temp files.

## 1. Create R2 bucket

1. In [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**.
2. Name it (e.g. `wineo-products`).
3. Choose a location (or leave default).

## 2. R2 API tokens

1. **R2** → **Manage R2 API Tokens** → **Create API token**.
2. Permissions: **Object Read & Write** (or custom with read/write on the bucket).
3. Copy **Access Key ID** and **Secret Access Key** (secret is shown once).

## 3. Get Account ID

- In the Cloudflare dashboard, open any domain or go to **Overview**. The **Account ID** is in the right sidebar.

## 4. Public access (for serving images)

Choose one:

- **Option A – R2 public bucket**  
  1. **R2** → your bucket → **Settings** → **Public access** → **Allow Access**.  
  2. Note the public URL (e.g. `https://pub-xxxx.r2.dev`).  
  3. Set `R2_PUBLIC_URL=https://pub-xxxx.r2.dev` (no trailing slash).

- **Option B – Custom domain**  
  1. **R2** → bucket → **Settings** → **Custom Domains** → add a domain (e.g. `cdn.yourdomain.com`).  
  2. Set `R2_PUBLIC_URL=https://cdn.yourdomain.com` (no trailing slash).

## 5. Backend .env

Copy from `.env.example` and set:

```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=wineo-products
R2_PUBLIC_URL=https://your-bucket-public-url-or-custom-domain
```

Optional:

- `R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com` — only if you need to override the default endpoint.

## 6. Lifecycle rule (auto-delete temp uploads)

Temp objects are stored under `temp/products/{userId}/{uuid}.jpg`. If the user never creates the product, these should be removed automatically.

1. **R2** → your bucket → **Settings** → **Lifecycle rules** (or **Rules**).
2. **Create rule**:
   - **Name:** `Delete temp product uploads`
   - **Prefix:** `temp/products/`
   - **Action:** Delete object (after 1 day or 24 hours).

Example (if the UI uses “Days”):

- **Prefix:** `temp/products/`
- **Delete objects after:** `1` day(s).

So: any object under `temp/products/` that is older than 1 day is deleted. When the product is created, the backend moves and resizes images to `products/{productId}/` and deletes the temp objects immediately, so they never reach the 1-day mark.

## 7. Path layout

| Path | Purpose |
|------|--------|
| `temp/products/{userId}/{uuid}.jpg` | Client uploads via presigned PUT; lifecycle deletes after 1 day if not moved. |
| `products/{productId}/thumbnail.jpg` | 400×400 thumbnail (first image). |
| `products/{productId}/image-1.jpg` | First image, 800×800. |
| `products/{productId}/image-N.jpg` | Other images, 800×800. |

Images are resized in memory with **sharp**; nothing is written to the server disk.

## 8. CORS (if frontend uploads from a different origin)

If the frontend uses presigned URLs and uploads from the browser to R2:

1. **R2** → bucket → **Settings** → **CORS policy**.
2. Add a policy that allows your frontend origin, e.g.:

```json
[
  {
    "AllowedOrigins": ["https://your-frontend.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Save. (If uploads go through your backend only, CORS on R2 may not be needed.)

## 9. Summary checklist

- [ ] R2 bucket created  
- [ ] API token created (Access Key ID + Secret Access Key)  
- [ ] Account ID noted  
- [ ] Public access or custom domain set; `R2_PUBLIC_URL` set in `.env`  
- [ ] Lifecycle rule for prefix `temp/products/` (delete after 1 day)  
- [ ] CORS configured on the bucket if the browser uploads directly to R2  

After that, the backend can issue presigned URLs, and product creation will move and resize images and remove temp objects; anything left in `temp/products/` will be removed by the lifecycle rule.
