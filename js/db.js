// js/db.js  — Firestore backend (mantiene la API de tu DB local)

// ===== Firebase (CDN v12) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy, where, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// —— TU CONFIG —— (la que me pasaste)
const firebaseConfig = {
  apiKey: "AIzaSyBTOlML4dMiryC6x7s7HAWvhkrT_j-U4D4",
  authDomain: "turnero-432d4.firebaseapp.com",
  projectId: "turnero-432d4",
  storageBucket: "turnero-432d4.firebasestorage.app",
  messagingSenderId: "259318366599",
  appId: "1:259318366599:web:1e56a25b022942b1095322"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ===== Utilidades =====
const defaults = {
  settings: { open:"09:00", close:"18:00", slot:30, wa:"549261333444", brand:"Estética Bellezza", pay_alias:"" }
};

function mapDocs(snap){ return snap.docs.map(d => ({ id:d.id, ...d.data() })); }
function uid(p="id"){ return p + Math.random().toString(36).slice(2,10); }

// ===== SETTINGS =====
async function getSettings(){
  try{
    const ref = doc(db, "settings", "app");
    const snap = await getDoc(ref);
    if(!snap.exists()){
      // Si no existe, creo defaults para que la UI tenga horarios YA
      await setDoc(ref, {...defaults.settings, createdAt: serverTimestamp()}, {merge:true});
      return {...defaults.settings};
    }
    // Migración suave de campos faltantes
    const data = { ...defaults.settings, ...snap.data() };
    return data;
  }catch(e){
    console.error("[DB.getSettings] ", e);
    return { ...defaults.settings };
  }
}
async function saveSettings(settings){
  const ref = doc(db, "settings", "app");
  await setDoc(ref, settings, { merge:true });
}

// ===== SERVICES =====
async function listServices(){
  try{
    const q = query(collection(db,"services"), orderBy("name"));
    const snap = await getDocs(q);
    return mapDocs(snap);
  }catch(e){
    console.error("[DB.listServices] ", e);
    return [];
  }
}
async function addService(svc){
  const id = svc.id || uid("svc_");
  await setDoc(doc(db,"services", id), { ...svc, id });
  window.dispatchEvent(new Event("services:loaded"));
  return { ...svc, id };
}
async function updateService(id, patch){
  await setDoc(doc(db,"services", id), patch, { merge:true });
  window.dispatchEvent(new Event("services:loaded"));
}
async function deleteService(id){
  await deleteDoc(doc(db,"services", id));
  window.dispatchEvent(new Event("services:loaded"));
}

// ===== BOOKINGS =====
async function listBookings(){
  try{
    // Para panel/landing sirve ordenar por fecha/hora
    const snap = await getDocs(collection(db,"bookings"));
    return mapDocs(snap);
  }catch(e){
    console.error("[DB.listBookings] ", e);
    return [];
  }
}
async function addBooking(b){
  const id = b.id || uid("bk_");
  await setDoc(doc(db,"bookings", id), {
    ...b, id, createdAt: b.createdAt || Date.now()
  });
  return { ...b, id };
}
async function updateBooking(id, patch){
  await setDoc(doc(db,"bookings", id), patch, { merge:true });
}
async function removeBooking(id){
  await deleteDoc(doc(db,"bookings", id));
}
// Alias compatibles con tu admin.js (por si los llama)
const deleteBooking = removeBooking;
const createBooking = addBooking;
const createService = addService;
const setService    = updateService;
const setBooking    = updateBooking;

// ===== (Dev) Guardado masivo — para compatibilidad con viejos "save*"
async function saveServices(list){
  const batch = writeBatch(db);
  list.forEach(s=>{
    const id = s.id || uid("svc_");
    batch.set(doc(db,"services", id), { ...s, id }, { merge:true });
  });
  await batch.commit();
}
async function saveBookings(list){
  const batch = writeBatch(db);
  list.forEach(b=>{
    const id = b.id || uid("bk_");
    batch.set(doc(db,"bookings", id), { ...b, id }, { merge:true });
  });
  await batch.commit();
}

// ===== Auto-seed (solo si está todo vacío) =====
async function autoSeedIfEmpty(){
  try{
    const svcs = await listServices();
    if(svcs.length === 0){
      const demo = [
        { id:"svc1", name:"Depilación Piernas Completas", duration:45, price:12000, color:"#6d6afe" },
        { id:"svc2", name:"Masaje Descontracturante 60'",  duration:60, price:18000, color:"#17c3b2" },
        { id:"svc3", name:"Limpieza Facial Profunda",     duration:50, price:16000, color:"#ff4d6d" },
      ];
      await saveServices(demo);
      console.log("→ Seed: services OK");
    }
    // settings ya se crean en getSettings() si faltan
  }catch(e){ console.warn("Seed skipped:", e.message); }
}

// Ejecutá el seed una sola vez
autoSeedIfEmpty();

// ===== API pública mantenida =====
window.DB = {
  // settings
  getSettings, saveSettings,

  // services
  listServices, addService, updateService, deleteService,
  saveServices, createService, setService,

  // bookings
  listBookings, addBooking, updateBooking, removeBooking,
  deleteBooking, saveBookings, createBooking, setBooking
};

console.log("DB listo (Firestore) ✅");

