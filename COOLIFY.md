# Deploying to Coolify

This project is now fully prepared to be hosted on Coolify, completely powered by Supabase. Follow these steps to get your app live.

## 1. Create the Database Tables in Supabase

Before deploying the app, you need to create the database schema in your self-hosted Supabase instance.

1. Go to your Supabase Studio (`https://supabase.mavtop.in`)
2. Log in and open your project.
3. On the left sidebar, click on **SQL Editor**.
4. Click **New Query**.
5. Open the `schema.sql` file in this repository, copy its entire contents, and paste it into the SQL Editor.
6. Click **Run** in the bottom right corner. This will create your `workspaces`, `custom_domains`, `short_urls`, and `profiles` tables, along with all the necessary Row Level Security (RLS) policies.

## 2. Connect GitHub to Coolify

If you haven't already linked your GitHub to Coolify:

1. Open your Coolify Dashboard (`https://data.mavtop.in`).
2. Go to **Sources** on the left menu.
3. Click **Add New** and choose **GitHub**.
4. Follow the steps to install the Coolify GitHub App on your GitHub account.

## 3. Deploy the Next.js Application

1. In Coolify, go to **Projects** and select (or create) a project and environment.
2. Click **New Resource** -> **Public Repository** (or **Private Repository** if it's private).
3. Select your GitHub App source.
4. Choose the repository `mavtoptech/shortlinks` and the branch `main`.
5. Coolify will automatically detect this as a Next.js application using **Nixpacks**.

## 4. Set Environment Variables

Before starting the deployment, you must set the environment variables so the app can connect to Supabase.

1. In your Coolify Application settings, go to the **Environment Variables** tab.
2. Add the following variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: (Your Supabase URL, e.g., `https://supabase.mavtop.in`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Your Supabase `anon` public key)
3. You can find these values in Supabase Studio -> **Project Settings** (the gear icon) -> **API**.

## 5. Deploy!

1. Once the environment variables are saved, click **Deploy**.
2. Coolify will build your Next.js application and start it.
3. Once running, go to the **Settings** tab of your app in Coolify to map a domain to it (e.g., `https://link.mavtop.in`).

You are now fully running on Coolify with Supabase Auth!
