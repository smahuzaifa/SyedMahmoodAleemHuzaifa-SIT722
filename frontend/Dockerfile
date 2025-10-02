# frontend/Dockerfile
FROM nginx:1.27-alpine
# Copy static files
COPY index.html /usr/share/nginx/html/
COPY main.js    /usr/share/nginx/html/
# Replace the default site
COPY nginx.conf /etc/nginx/conf.d/default.conf
