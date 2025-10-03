# Tiny static container
FROM nginx:1.27-alpine

# Copy our Nginx site config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets
COPY index.html /usr/share/nginx/html/index.html
COPY main.js   /usr/share/nginx/html/main.js

EXPOSE 80
