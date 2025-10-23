// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Región recomendada (cámbiala si quieres)
const region = functions.region("us-central1");

// Configs (setéalas con: firebase functions:config:set ...)
const CFG = {
  TZ: (functions.config().general && functions.config().general.tz) || "America/Argentina/Salta",
  PUBLIC_URL: (functions.config().general && functions.config().general.public_url) || "https://TU_DOMINIO",
  WABA_TOKEN: functions.config().waba && functions.config().waba.token,
  WABA_PHONE_ID: functions.config().waba && functions.config().waba.phone_id,
};

function ymdToDateMs(date, time) {
  const [y,m,d] = date.split("-").map(Number);
  const [hh,mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m-1, d, hh, mm, 0, 0)).getTime();
}

async function sendWhatsApp(phone, text){
  if(!CFG.WABA_TOKEN || !CFG.WABA_PHONE_ID) throw new Error("WABA credentials missing");
  const url = `https://graph.facebook.com/v20.0/${CFG.WABA_PHONE_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: text }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CFG.WABA_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const j = await res.json();
  if(!res.ok){
    console.error("WABA error", j);
    throw new Error("WABA send failed");
  }
  return j;
}

async function runWindowH2(){
  const now = Date.now();
  const start = now - 10*60*1000; // -10 min
  const end   = now + 10*60*1000; // +10 min

  const snap = await db.collection("bookings")
    .where("status","in",["confirmado","asistio"])
    .get();

  const items = snap.docs.map(d=>({id:d.id, ...d.data()}));
  const kind = "h2";

  const todo = items.filter(b=>{
    const when = ymdToDateMs(b.date, b.time) - 2*60*60*1000; // 2 h antes
    const flag = b.reminders && b.reminders[kind];
    return !flag && when>=start && when<=end;
  });

  for(const b of todo){
    const cancelUrl = `${CFG.PUBLIC_URL.replace(/\/$/,'')}/cancel.html?id=${b.id}&token=${b.cancelToken}`;
    const msg = `Hola ${b.name}! Recordatorio: tu turno es hoy a las ${b.time}. Si necesitás cancelar: ${cancelUrl}`;
    try{
      await sendWhatsApp(b.phone, msg);
      await db.collection("bookings").doc(b.id).set({reminders:{...b.reminders, [kind]: true}}, {merge:true});
      console.log("Reminder sent", b.id, kind);
    }catch(e){
      console.error("Reminder failed", b.id, e);
    }
  }
}

// Función programada (requiere plan Blaze)
exports.scheduleH2 = region.pubsub.schedule("every 5 minutes").timeZone(CFG.TZ).onRun(async ()=>{
  await runWindowH2();
  return null;
});
