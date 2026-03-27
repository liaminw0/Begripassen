#!/usr/bin/env bash

set -eu

BASE_URL="${CF_PAGES_URL:-https://begripassen.nl}"

hugo --gc --minify -b "$BASE_URL"
