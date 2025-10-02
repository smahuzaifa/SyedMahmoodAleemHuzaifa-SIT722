# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app

# copy manifests first to leverage layer cache
COPY package.json package-lock.json* ./

# if lockfile exists use ci, else use install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# now copy the rest of the app
COPY . .

# build your app (React: build/, Vite: dist/)
# if you use Vite replace 'build' below with 'dist'
RUN npm run build

# ---- run ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf

# React -> /app/build ; Vite -> /app/dist
#   change BUILD_DIR to dist if you use Vite
ARG BUILD_DIR=build
COPY --from=build /app/${BUILD_DIR} /usr/share/nginx/html

EXPOSE 80
