# frontend/Dockerfile
FROM nginx:1.27-alpine

# If you use client-side routing (React/Vite/SPA), keep nginx.conf change below.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy ALL static assets to the Nginx web root
COPY . /usr/share/nginx/html

EXPOSE 80
