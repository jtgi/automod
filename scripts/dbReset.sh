#!/bin/bash

source .env

if [[ $DATABASE_URL != *"localhost:5432"* ]]; then
  echo "Database URL is not localhost:5432"
  exit 1
fi

prisma db push --force-reset && prisma db seed