#!/bin/bash
pnpm run build 
cp -R dist/* /var/www/asn1/
sudo chown -R www-data:www-data /var/www/asn1/
