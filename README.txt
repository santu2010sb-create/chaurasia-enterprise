SHIVAM TOUR & TRAVELS — Android Admin Fix

Why this version:
The old admin.html was opened as an Android content:// local file. That can prevent browser JavaScript/API requests from working reliably. This version is served directly by the same Render server, so the admin panel and API use the same web origin.

Files:
- server.js      existing backend + /admin route
- admin.html     Android-friendly admin panel
- Dockerfile     copies admin.html into the Render container

IMPORTANT:
Do not change your existing JWT_SECRET or ADMIN_PASSWORD in Render.

Deploy steps:
1. In GitHub repository santu2010sb-create/shivam-tour-travels, upload/replace ONLY:
   server.js
   admin.html
   Dockerfile
2. Commit the changes.
3. In Render, open the service shivam-tour-travels and deploy the latest commit.
4. After Deploy succeeded, open:
   https://shivam-tour-travels-l740.onrender.com/admin
5. Enter:
   Username: admin
   Password: the ADMIN_PASSWORD currently saved in Render.
6. First tap Check Server. It should show SERVER OK.
7. Then tap Login & Connect.

Do NOT open admin.html from Downloads/file manager. Use the /admin web address above.

The API/database routes are kept from the existing working backend.
