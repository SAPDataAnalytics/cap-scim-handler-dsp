# Proposta UI Fiori Elements per DSP SCIM Handler

Questa proposta di interfaccia utente Fiori Elements si basa sulle funzionalità descritte nel README del progetto e sulle best practice SAP Fiori Elements per OData V4.

## Obiettivi UI
- Visualizzare utenti SCIM (UsersVH) in una List Report e Object Page
- Visualizzare ruoli aggregati (RolesVH) e conteggio utenti
- Visualizzare associazioni utente-ruolo (UserRolesVH)
- Permettere l'esecuzione delle azioni di sincronizzazione (SyncUsersVHToUsers, SyncRolesFromSCIM, SyncUserRolesFromSCIM)
- Mostrare lo stato delle sincronizzazioni e messaggi di errore

## Struttura proposta

### 1. Home Page
- **Titolo:** "Gestione Utenti e Ruoli DSP SCIM"
- **Tabs:**
  - Utenti
  - Ruoli
  - Associazioni
  - Sincronizzazione

### 2. Tab "Utenti"
- **List Report:** Tabella con colonne: Username, Display Name, Email, First Name, Last Name
- **Object Page:** Dettaglio utente con tutti gli attributi
- **Fonte dati:** `/data/UsersVH`
- **Azioni:**
  - Pulsante "Sincronizza utenti" (POST `/data/SyncUsersVHToUsers`)
  - Azione configurata come unbound, visibile nella toolbar

### 3. Tab "Ruoli"
- **List Report:** Tabella con colonne: Role Value, Role Display, User Count
- **Fonte dati:** `/data/RolesVH`
- **Azioni:**
  - Pulsante "Sincronizza ruoli" (POST `/data/SyncRolesFromSCIM`)
  - Azione configurata come unbound, visibile nella toolbar

### 4. Tab "Associazioni"
- **List Report:** Tabella con colonne: UserName, DisplayName, Email, RoleValue, RoleDisplay
- **Fonte dati:** `/data/UserRolesVH`
- **Azioni:**
  - Pulsante "Sincronizza associazioni" (POST `/data/SyncUserRolesFromSCIM`)
  - Azione configurata come unbound, visibile nella toolbar

### 5. Tab "Sincronizzazione"
- **Storico sincronizzazioni** (opzionale, se disponibile)
- **Messaggi di stato** (successo/errore)

## Componenti Fiori Elements suggeriti
- **List Report** per UsersVH, RolesVH, UserRolesVH
- **Object Page** per dettaglio utente
- **Action Button** per chiamare le azioni di sincronizzazione (unbound, context-independent)
- **Message Toast/Dialog** per feedback

## Esempio di annotazioni CDS per azioni
```cds
annotate service.UsersVH with @(
    UI: {
        LineItem: [
            {Value: userName, Label: 'Username'},
            {Value: displayName, Label: 'Display Name'},
            {Value: email, Label: 'Email'},
            {Value: firstName, Label: 'First Name'},
            {Value: lastName, Label: 'Last Name'},
            {
                $Type: 'UI.DataFieldForAction',
                Label: 'Sincronizza utenti',
                Action: 'DSPUsers.SyncUsersVHToUsers',
                InvocationGrouping: 'UI.OperationGroupingType/Isolated'
            }
        ]
    }
);
```

## Flusso utente
1. L'utente accede alla UI autenticato tramite XSUAA
2. Visualizza la lista utenti SCIM live
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
- Azioni configurate come unbound (context-independent) secondo le best practice SAP Fiori Elements

## Prossimi passi
- Validare la proposta con gli stakeholder
- Definire le annotazioni CDS necessarie
- Generare la UI con Fiori Elements (cds add fiori, cds add approuter)
- Personalizzare estensioni se necessario

---

Questa proposta è pronta per essere implementata tramite #mcp_sap-fiori_execute-functionality, scegliendo i template List Report/Object Page e configurando le azioni custom secondo la documentazione SAP Fiori Elements.

Per approfondimenti sulle azioni custom e toolbar, vedi la documentazione SAPUI5: https://ui5.sap.com/#/topic/cbf16c599f2d4b8796e3702f7d4aae6c
