# Backend — Recordatorios automáticos (2 horas antes)

Este backend envía recordatorios **automáticos** por WhatsApp **2 horas antes** del turno.

## Tecnologías
- **Firebase**: Firestore + Cloud Functions (Node.js)
- **WhatsApp Cloud API** (Meta)

## Estructura de Firestore (colección `bookings`)
- Campos: id, date (YYYY-MM-DD), time (HH:MM), serviceId, name, phone, status, cancelToken, reminders.h2, createdAt (ms)

## Configuración
1. Crear proyecto Firebase. Habilitar **Firestore** y **Functions**.
2. `cd backend/functions`
3. `npm i`
4. Configurar variables:
   ```bash
   firebase functions:config:set waba.token="EAAG..." waba.phone_id="123456789" general.tz="America/Argentina/Salta"
   ```
5. Deploy:
   ```bash
   firebase deploy --only functions
   ```