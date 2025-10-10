#!/bin/bash
pnpm run build 
sudo cp -R dist/* /var/www/asn1.app/
sudo chown -R www-data:www-data /var/www/asn1.app/
