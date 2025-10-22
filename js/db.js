// db.js — Local storage (v4) + tokens/reminder flags + pay alias
(function(){
  const storage = {
    services: 'tp4_services',
    bookings: 'tp4_bookings',
    settings: 'tp4_settings',
    admin:    'tp4_admin'
  };
  function lsGet(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch(e){ return fallback; } }
  function lsSet(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  window.DB = {
    listServices: async ()=> lsGet(storage.services, []),
    saveServices: async (list)=> lsSet(storage.services, list),
    listBookings: async ()=> lsGet(storage.bookings, []),
    addBooking:   async (b)=> { const list=lsGet(storage.bookings,[]); list.push(b); lsSet(storage.bookings,list); return b; },
    updateBooking:async (id, patch)=>{ const list=lsGet(storage.bookings,[]); const i=list.findIndex(x=>x.id===id); if(i>=0){ list[i] = Object.assign({}, list[i], patch); lsSet(storage.bookings, list); } },
    removeBooking:async (id)=>{ const list=lsGet(storage.bookings,[]).filter(x=>x.id!==id); lsSet(storage.bookings, list); },
    getSettings:  async ()=> lsGet(storage.settings, {open:'09:00', close:'18:00', slot:30, wa:'549261333444', brand:'Estética Bellezza', pay_alias:''}),
    saveSettings: async (s)=> lsSet(storage.settings, s),
    getAdmin:     ()=> lsGet(storage.admin, {logged:false}),
    setAdmin:     (v)=> lsSet(storage.admin, v),
    storage
  };

  // Seed once
  if(!localStorage.getItem('tp4_seed_v1')){
    const services = [{"id": "svc1", "name": "Depilación Piernas Completas", "duration": 45, "price": 12000, "color": "#6d6afe"}, {"id": "svc2", "name": "Masaje Descontracturante 60'", "duration": 60, "price": 18000, "color": "#17c3b2"}, {"id": "svc3", "name": "Limpieza Facial Profunda", "duration": 50, "price": 16000, "color": "#ff4d6d"}, {"id": "svc4", "name": "Manicura Semipermanente", "duration": 45, "price": 10000, "color": "#f59e0b"}, {"id": "svc5", "name": "Perfilado de Cejas", "duration": 20, "price": 7000, "color": "#9b59b6"}];
    const bookings = [{"id": "b1", "date": "2025-10-17", "time": "09:30", "serviceId": "svc3", "name": "Sofía M.", "phone": "549261555101", "notes": "Piel sensible", "status": "confirmado", "createdAt": 1760727498288, "cancelToken": "QQSW7KHAqtPXwxN5", "reminders": {"h2": false}}, {"id": "b2", "date": "2025-10-17", "time": "10:30", "serviceId": "svc1", "name": "Luz M.", "phone": "549261555102", "notes": "", "status": "confirmado", "createdAt": 1760728498288, "cancelToken": "hFD5Dq9bcYqx9rHz", "reminders": {"h2": false}}, {"id": "b3", "date": "2025-10-17", "time": "12:00", "serviceId": "svc4", "name": "Rocío G.", "phone": "549261555103", "notes": "Color nude", "status": "confirmado", "createdAt": 1760729498288, "cancelToken": "hnV6odeduSLDxFYD", "reminders": {"h2": false}}, {"id": "b4", "date": "2025-10-18", "time": "11:00", "serviceId": "svc2", "name": "Brenda P.", "phone": "549261555104", "notes": "Zona cervical", "status": "confirmado", "createdAt": 1760730498288, "cancelToken": "BEDXSU9bZ0iF6hRT", "reminders": {"h2": false}}, {"id": "b5", "date": "2025-10-18", "time": "16:00", "serviceId": "svc5", "name": "Agustina R.", "phone": "549261555105", "notes": "", "status": "confirmado", "createdAt": 1760731498288, "cancelToken": "7VMcmi7w2yXmzevE", "reminders": {"h2": false}}];
    const settings = {open:'09:00', close:'18:00', slot:30, wa:'549261333444', brand:'Estética Bellezza', pay_alias:'alias.bellezza.mp'};
    lsSet(storage.services, services);
    lsSet(storage.bookings, bookings);
    lsSet(storage.settings, settings);
    localStorage.setItem('tp4_seed_v1','1');
  }
})();
