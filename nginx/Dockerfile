FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Directories for the volumes will be mounted at runtime:
#   /usr/share/nginx/html/app     ← frontend dist
#   /usr/share/nginx/html/static  ← Django collected static
