#!/usr/bin/env python3
"""
Script per testare l'endpoint CAP con autenticazione XSUAA
"""

import requests
import sys

# Configurazione
CLIENT_ID = "sb-na-2998b23b-75a0-4640-a2df-70f70186925a!t32453"
CLIENT_SECRET = "236dcb54-b0c7-4f23-b371-0886603ae025$sMExRnYMItLrnRlIJwrFhUzaCMEHKOgB-CbG16NrFs0="

# URL XSUAA per ottenere il token (derivato dal client_id)
XSUAA_URL = "https://dev-datasphere-gcp.authentication.eu30.hana.ondemand.com/oauth/token"

# Endpoint da testare
SERVICE_URL = "https://acea-dev-datasphere-gcp-dev-dsp-scim-handler-srv.cfapps.eu30.hana.ondemand.com"
ENDPOINT = "/data/SyncUsersVHToUsers"


def get_oauth_token():
    """Ottiene un token OAuth2 dal servizio XSUAA"""
    print(f"🔐 Richiesta token a: {XSUAA_URL}")
    
    try:
        response = requests.post(
            XSUAA_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            print(f"   ✅ Token ottenuto! Tipo: {token_data.get('token_type')}")
            print(f"   Scadenza: {token_data.get('expires_in')} secondi")
            return token_data.get("access_token")
        else:
            print(f"   ❌ Errore: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Eccezione: {e}")
        return None


def test_endpoint(token, endpoint, method="GET"):
    """Testa un endpoint con il token OAuth"""
    url = f"{SERVICE_URL}{endpoint}"
    print(f"\n🌐 Test endpoint ({method}): {url}")
    
    try:
        if method == "POST":
            response = requests.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                json={}
            )
        else:
            response = requests.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json"
                }
            )
        
        print(f"   Status: {response.status_code}")
        print(f"   Headers: {dict(response.headers)}")
        
        if response.status_code in [200, 201, 204]:
            print(f"   ✅ Risposta OK!")
            try:
                data = response.json()
                print(f"   Dati: {data}")
            except:
                print(f"   Body: {response.text[:500]}")
        else:
            print(f"   ❌ Errore: {response.text[:500]}")
            
        return response
        
    except Exception as e:
        print(f"   ❌ Eccezione: {e}")
        return None


def test_without_auth(endpoint):
    """Testa un endpoint senza autenticazione"""
    url = f"{SERVICE_URL}{endpoint}"
    print(f"\n🌐 Test endpoint SENZA AUTH: {url}")
    
    try:
        response = requests.get(url)
        print(f"   Status: {response.status_code}")
        print(f"   Body: {response.text[:300]}")
        return response
    except Exception as e:
        print(f"   ❌ Eccezione: {e}")
        return None


def main():
    print("=" * 60)
    print("TEST ENDPOINT CAP - dsp-scim-handler")
    print("=" * 60)
    
    # Test senza autenticazione (per vedere cosa risponde)
    print("\n--- Test senza autenticazione ---")
    test_without_auth("/")
    test_without_auth(ENDPOINT)
    
    # Ottieni token
    print("\n--- Ottenimento Token OAuth2 ---")
    token = get_oauth_token()
    
    if not token:
        print("\n❌ Impossibile ottenere il token. Verifica le credenziali.")
        sys.exit(1)
    
    # Test con autenticazione
    print("\n--- Test con autenticazione ---")
    test_endpoint(token, "/")
    test_endpoint(token, "/$metadata")
    
    # Test Actions con POST
    print("\n--- Test Actions (POST) ---")
    test_endpoint(token, ENDPOINT, method="POST")
    test_endpoint(token, "/data/SyncRolesFromSCIM", method="POST")
    test_endpoint(token, "/data/SyncUserRolesFromSCIM", method="POST")
    
    # Test altri endpoint comuni
    print("\n--- Test altri endpoint ---")
    test_endpoint(token, "/data")
    test_endpoint(token, "/data/Users")
    test_endpoint(token, "/data/Roles")
    test_endpoint(token, "/data/UsersVH")
    test_endpoint(token, "/data/RolesVH")


if __name__ == "__main__":
    main()
