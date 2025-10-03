# frontend/Dockerfile
FROM nginx:1.27-alpine

# Copy static site
COPY index.html /usr/share/nginx/html/index.html
COPY main.js    /usr/share/nginx/html/main.js

# Nginx site config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
