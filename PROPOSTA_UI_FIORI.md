# Proposta UI Fiori Elements per DSP SCIM Handler

Questa proposta di interfaccia utente Fiori Elements si basa sulle funzionalità descritte nel README del progetto. L'obiettivo è fornire una UI moderna e integrata per la gestione e la visualizzazione di utenti, ruoli e associazioni SCIM provenienti da SAP Datasphere/Analytics Cloud.

## Obiettivi UI
- Visualizzare gli utenti SCIM (UsersVH) in una lista e dettaglio
- Visualizzare i ruoli aggregati (RolesVH) e il conteggio utenti
- Visualizzare le associazioni utente-ruolo (UserRolesVH)
- Permettere l'esecuzione delle azioni di sincronizzazione (SyncUsersVHToUsers, SyncRolesFromSCIM, SyncUserRolesFromSCIM)
- Mostrare lo stato delle sincronizzazioni e messaggi di errore

## Struttura proposta

### 1. Home Page
- **Titolo:** "Gestione Utenti e Ruoli DSP SCIM"
- **Tabs:**
  - Utenti
  - Ruoli
  - Associazioni Utenti - Ruoli
  - Associazioni Oggetti Autorizzativi - Ruoli
  - Sincronizzazione

### 2. Tab "Utenti"
- **Lista:** Tabella con colonne: Username, Display Name, Email, First Name, Last Name
- **Dettaglio:** Object Page con tutti gli attributi utente
- **Fonte dati:** `/data/Users`
- **Azioni:** Pulsante "Sincronizza utenti" (POST `/data/SyncUsersVHToUsers`)

### 3. Tab "Ruoli"
- **Lista:** Tabella con colonne: Role Value, Role Display, User Count
- **Fonte dati:** `/data/Roles`
- **Azioni:** Pulsante "Sincronizza ruoli" (POST `/data/SyncRolesFromSCIM`)

### 4. Tab "Associazioni" Utenti - Ruoli
- **Lista:** Tabella con colonne: UserName, DisplayName, Email, RoleValue, RoleDisplay
- **Fonte dati:** `/data/UserRoles`
- **Azioni:** Pulsante "Sincronizza associazioni" (POST `/data/SyncUserRolesFromSCIM`)

### 5. Tab "Associazioni" Oggetti Autorizzativi - Ruoli
- **Lista:** Tabella con colonne: AuthObject, Role
- **Fonte dati:** `/data/AuthObjectRoles`
- **Azioni:**  CRUD

### 6. Tab "Sincronizzazione"
- **Storico sincronizzazioni** (opzionale, se disponibile)
- **Messaggi di stato** (successo/errore)

## Componenti Fiori Elements suggeriti
- **List Report** per Users, Roles, UserRoles, AuthObjectRoles
- **Object Page** per dettaglio utente
- **Action Button** per chiamare le azioni di sincronizzazione
- **Message Toast/Dialog** per feedback

## Esempio di flusso utente
1. L'utente accede alla UI autenticato tramite XSUAA
2. Visualizza la lista utenti SCIM 
3. Può filtrare/cercare utenti, vedere dettagli
4. Può lanciare la sincronizzazione verso HDI
5. Passa ai ruoli, vede aggregati e conteggi
6. Può sincronizzare ruoli e associazioni
7. Riceve feedback su successo/errore

## Considerazioni tecniche
- Tutte le chiamate sono OData V4
- Le azioni sono esposte come POST su entity set
- La UI non modifica dati SCIM, solo visualizza e lancia sync
- Autenticazione via XSUAA

## Prossimi passi
- Validare la proposta con gli stakeholder
- Definire le annotazioni CDS necessarie
- Generare la UI con Fiori Elements (cds add fiori, cds add approuter)
- Personalizzare estensioni se necessario

---

Questa proposta può essere implementata tramite #mcp_sap-fiori_execute-functionality, scegliendo i template List Report/Object Page e configurando le azioni custom.
