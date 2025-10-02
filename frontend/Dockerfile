# frontend/Dockerfile
FROM nginx:1.27-alpine

# reverse proxy rules for the APIs
COPY nginx.conf /etc/nginx/conf.d/default.conf

# serve the static assets
COPY . /usr/share/nginx/html/
