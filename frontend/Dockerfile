# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run (nginx) ----
FROM nginx:1.27-alpine
# put our config in the default site location
COPY nginx.conf /etc/nginx/conf.d/default.conf
# copy the built static site
COPY --from=build /app/build /usr/share/nginx/html
# nginx:alpine already runs with: nginx -g 'daemon off;'
EXPOSE 80
