#!/usr/bin/env python3
"""
Script per testare la nuova azione SearchRole per cercare un ruolo specifico
"""

import requests
import json
import sys

# Configurazione da test_endpoint.py
CLIENT_ID = "sb-na-2998b23b-75a0-4640-a2df-70f70186925a!t32453"
CLIENT_SECRET = "236dcb54-b0c7-4f23-b371-0886603ae025$sMExRnYMItLrnRlIJwrFhUzaCMEHKOgB-CbG16NrFs0="

# URL XSUAA per ottenere il token
XSUAA_URL = "https://dev-datasphere-gcp.authentication.eu30.hana.ondemand.com/oauth/token"

# Endpoint CAP deployato
SERVICE_URL = "https://acea-dev-datasphere-gcp-dev-dsp-scim-handler-srv.cfapps.eu30.hana.ondemand.com"

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
            },
            timeout=10
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


def call_search_role(token, role_value):
    """Chiama l'azione SearchRole sul servizio CAP"""
    url = f"{SERVICE_URL}/data/SearchRole"
    print(f"\n🔍 Ricerca ruolo: {role_value}")
    print(f"🌐 Endpoint: {url}\n")
    
    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            json={"roleValue": role_value},
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"\n✅ Risposta ricevuta:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            if data.get('exists'):
                print(f"\n🎉 Ruolo TROVATO: '{role_value}'")
                users = data.get('found_in_users', [])
                if users:
                    print(f"\n👥 Trovato in {len(users)} utente(i):")
                    for u in users:
                        print(f"   - {u.get('userName', 'N/A')} ({u.get('displayName', 'N/A')})")
            else:
                print(f"\n❌ Ruolo NON TROVATO: '{role_value}'")
                print(f"   Il ruolo non è assegnato a nessun utente attivo nell'API SCIM")
        else:
            print(f"   ❌ Errore: {response.status_code}")
            print(f"   Body: {response.text[:500]}")
            
        return response
        
    except Exception as e:
        print(f"   ❌ Eccezione: {e}")
        return None


def main():
    # Ruolo da cercare
    if len(sys.argv) > 1:
        role_to_search = sys.argv[1]
    else:
        role_to_search = "BW_C_IT_0170_AEEN_COCGU"
    
    print(f"=" * 70)
    print(f"TEST RICERCA RUOLO - CAP SCIM Handler Service")
    print(f"=" * 70)
    
    # Ottieni token
    token = get_oauth_token()
    if not token:
        print("\n❌ Impossibile ottenere token - test fallito")
        sys.exit(1)
    
    # Chiama SearchRole
    call_search_role(token, role_to_search)
    
    print(f"\n" + "=" * 70)


if __name__ == "__main__":
    main()
