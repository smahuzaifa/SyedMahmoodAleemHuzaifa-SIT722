# Simple, reliable static image — your app is plain HTML/JS.
FROM nginx:1.27-alpine

# Copy our NGINX site config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static UI
COPY index.html /usr/share/nginx/html/index.html
COPY main.js   /usr/share/nginx/html/main.js
