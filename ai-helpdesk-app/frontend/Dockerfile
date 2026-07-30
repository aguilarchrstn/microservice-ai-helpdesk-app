# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# --- serve stage ---
# nginxinc/nginx-unprivileged is purpose-built to run as a non-root user:
# it listens on 8080 by default (not the privileged port 80) and has all
# the cache/pid-file permissions already set up for that user. Plain
# nginx:alpine can't just add a USER line — its master process needs root
# to bind port 80, so switching base images is the actual fix rather than
# a workaround.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8080/ || exit 1

