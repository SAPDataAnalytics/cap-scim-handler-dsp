#!/bin/bash

# Test Script per la nuova azione SearchRole
# Uso: bash test_commands.sh <token>

# Oppure se hai le credenziali XSUAA:
# bash test_commands.sh --get-token

set -euo pipefail

SERVICE_URL="https://acea-dev-datasphere-gcp-dev-dsp-scim-handler-srv.cfapps.eu30.hana.ondemand.com"
XSUAA_URL="https://dev-datasphere-gcp.authentication.eu30.hana.ondemand.com/oauth/token"
CLIENT_ID="sb-na-2998b23b-75a0-4640-a2df-70f70186925a!t32453"
CLIENT_SECRET='236dcb54-b0c7-4f23-b371-0886603ae025$sMExRnYMItLrnRlIJwrFhUzaCMEHKOgB-CbG16NrFs0='

ROLE_TO_SEARCH="BW_C_IT_0170_AEEN_COCGU"

# Function per ottenere il token
get_token() {
    echo "🔐 Ottenimento token OAuth2..." >&2
    TOKEN=$(curl -s -X POST "$XSUAA_URL" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data-urlencode "grant_type=client_credentials" \
        --data-urlencode "client_id=$CLIENT_ID" \
        --data-urlencode "client_secret=$CLIENT_SECRET" \
        | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        echo "❌ Errore: Token non ottenuto" >&2
        exit 1
    fi
    
    echo "✅ Token ottenuto: ${TOKEN:0:50}..." >&2
    echo "$TOKEN"
}

# Function per cercare un ruolo
search_role() {
    local token=$1
    local role=$2
    
    echo ""
    printf '%0.s=' {1..70}; echo
    echo "🔍 Ricerca ruolo: $role"
    printf '%0.s=' {1..70}; echo
    
    curl -X POST "$SERVICE_URL/data/SearchRole" \
        -H "Authorization: Bearer $token" \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        -d "{\"roleValue\": \"$role\"}" | jq .
}

# Main
if [ "$1" == "--get-token" ]; then
    TOKEN=$(get_token)
else
    TOKEN="${1:-}"
    if [ -z "$TOKEN" ]; then
        echo "❌ Uso: $0 <token> oppure $0 --get-token"
        echo ""
        echo "Per ottenere il token automaticamente:"
        echo "  bash $0 --get-token"
        echo ""
        echo "Oppure con un token fornito:"
        echo "  bash $0 <access_token>"
        exit 1
    fi
fi

# Test endpoint 1: Leggi tutti i ruoli (RolesVH)
echo ""
printf '%0.s=' {1..70}; echo
echo "📊 Test 1: Leggi tutti i ruoli (RolesVH)"
printf '%0.s=' {1..70}; echo
curl -s "$SERVICE_URL/data/RolesVH?%24top=10" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json" | jq . | head -50

# Test endpoint 2: Cerca il ruolo specifico
search_role "$TOKEN" "$ROLE_TO_SEARCH"

# Test endpoint 3: Cerca un altro ruolo di prova
echo ""
printf '%0.s=' {1..70}; echo
echo "🧪 Test 2: Ricerca ruolo inesistente"
printf '%0.s=' {1..70}; echo
search_role "$TOKEN" "ROLE_NON_ESISTENTE_12345"

echo ""
printf '%0.s=' {1..70}; echo
echo "✅ Test completato"
printf '%0.s=' {1..70}; echo
