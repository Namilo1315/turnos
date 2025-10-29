// ===== PUBLIC (Landing + Turnero) =====
const $ = s => document.querySelector(s);
const svcSel = $('#svc'), dateInp = $('#date'), durInp = $('#duration'), timesWrap = $('#times');
const nameInp=$('#name'), phoneInp=$('#phone'), notesInp=$('#notes'), reserveBtn=$('#reserveBtn'), svcCards=$('#svcCards');

function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; }

/* ==== UI helpers mínimos ==== */
(function injectUiStyles(){
  const css = `
    .is-loading { position:relative; pointer-events:none; opacity:.9; }
    .is-loading::after{
      content:"";
      position:absolute; inset:0;
      background:
        radial-gradient(18px 8px at 50% calc(50% - 6px), rgba(255,255,255,.85) 40%, transparent 41%) no-repeat,
        radial-gradient(18px 8px at 50% calc(50% + 6px), rgba(255,255,255,.85) 40%, transparent 41%) no-repeat;
      animation: pulseDots 1s infinite linear; border-radius:.5rem;
    }
    @keyframes pulseDots {
      0%{ background-position:49% 45%, 51% 55% } 50%{ background-position:51% 45%, 49% 55% } 100%{ background-position:49% 45%, 51% 55% }
    }
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
})();

/* Toast (SweetAlert) */
const Toast = Swal.mixin({
  toast: true, position: 'top-end', showConfirmButton: false,
  timer: 2000, timerProgressBar: true,
  didOpen: (t)=>{ t.addEventListener('mouseenter', Swal.stopTimer); t.addEventListener('mouseleave', Swal.resumeTimer); }
});

(async function init(){
  const services = await DB.listServices();
  const settings = await DB.getSettings();

  // === Combos ===
  svcSel.innerHTML = services.map(s =>
    `<option value="${s.id}" data-duration="${s.duration}" data-color="${s.color}" data-price="${s.price}">
      ${s.name} — $${s.price}
     </option>`).join('');
  durInp.value = (services[0]?.duration || 30) + ' min';
  if(!dateInp.value) dateInp.value = todayISO();

  // === Tarjetas para el carrusel (como espera index.html: .svc-card) ===
  // Usamos el color del servicio como "cover" de respaldo.
  svcCards.innerHTML = services.map(s => `
    <article class="svc-card">
      <div class="svc-cover" style="background:linear-gradient(135deg, ${s.color}33, #ffffff)"></div>
      <div class="svc-body d-flex flex-column gap-1">
        <div class="d-flex justify-content-between align-items-center">
          <h6 class="svc-title mb-0">${s.name}</h6>
          <span class="svc-price">AR$ ${s.price}</span>
        </div>
        <div class="svc-meta">Duración aprox. ${s.duration} minutos</div>
        <button class="btn btn-sm btn-outline-primary mt-2" onclick="seleccionarServicio('${s.name}')">Reservar</button>
      </div>
    </article>
  `).join('');
  // Dejamos que el script del index reconstruya el carrusel desde #svcCards

  svcSel.addEventListener('change', ()=>{
    const opt=svcSel.selectedOptions[0];
    durInp.value = (opt?.dataset.duration || 30) + ' min';
    refreshTimes();
  });
  dateInp.addEventListener('change', refreshTimes);

  async function refreshTimes(){
    const date = dateInp.value;
    const bookings = await DB.listBookings();
    const cfg = await DB.getSettings();
    const step = parseInt((cfg.slot || 30), 10);
    const open = (cfg.open || '09:00');
    const close = (cfg.close || '18:00');

    const slots = genSlots(open, close, step);
    const occupiedTimes = new Set(
      bookings.filter(b => b.date===date && b.status!=='cancelado').map(b => b.time)
    );

    // Render con la misma semántica / clases que tu index.html (.slot)
    timesWrap.innerHTML = slots.map(t=>{
      const isOcc = occupiedTimes.has(t);
      const cls = `slot ${isOcc ? 'disabled' : ''}`;
      return `<div class="${cls}" data-time="${t}">${t}</div>`;
    }).join('');
    // La selección visual la maneja el listener global del index ('.times .slot')
  }

  function genSlots(open, close, step){
    const [oh,om]=open.split(':').map(Number); const [ch,cm]=close.split(':').map(Number);
    const start=oh*60+om, end=ch*60+cm; const out=[];
    for(let m=start; m<=end-step; m+=step){
      const hh=String(Math.floor(m/60)).padStart(2,'0'); const mm=String(m%60).padStart(2,'0');
      out.push(`${hh}:${mm}`);
    }
    return out;
  }

  await refreshTimes();

  reserveBtn.addEventListener('click', async ()=>{
    try{
      reserveBtn.classList.add('is-loading'); reserveBtn.setAttribute('disabled','');

      const allServices = await DB.listServices();
      const cfg = await DB.getSettings();

      const svc = allServices.find(s=>s.id===svcSel.value);
      const date = dateInp.value;
      const chosenEl = timesWrap.querySelector('.slot.active');
      const time = chosenEl?.dataset.time;
      const name = nameInp.value.trim();
      const phone = (phoneInp.value||'').replace(/\D/g,'');
      const notes = notesInp.value.trim();

      if(!svc || !date || !time || !name || !phone){
        Toast.fire({icon:'warning', title:'Completá servicio, fecha, horario, nombre y WhatsApp.'});
        return;
      }

      const cancelToken = Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);

      // IMPORTANTE: usamos el id REAL que devuelve la DB
      const saved = await DB.addBooking({
        date, time, serviceId: svc.id, name, phone, notes,
        status:'confirmado', createdAt: Date.now(), cancelToken, reminders:{h2:false}
      });

      if(chosenEl){
        chosenEl.classList.remove('active');
        chosenEl.classList.add('disabled');
        chosenEl.textContent = time;
      }

      // URL robusta a cancel.html en el mismo sitio
      const baseCancel = new URL('cancel.html', location.href).toString();
      const cancelUrl = `${baseCancel}?id=${encodeURIComponent(saved.id)}&token=${encodeURIComponent(saved.cancelToken || cancelToken)}`;

      const alias = cfg.pay_alias || '';
      const aliasBlock = alias
        ? `<div class="mt-2">Podés abonar por <strong>alias</strong>: <code>${alias}</code> <button class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText('${alias}')">Copiar</button></div>`
        : '';

      await Swal.fire({
        icon:'success',
        title:'¡Tu turno está reservado!',
        html: `
          <div class="text-start small">
            <div><strong>Servicio:</strong> ${svc.name}</div>
            <div><strong>Fecha:</strong> ${fmtDate(date)} ${time} hs</div>
            <div><strong>Cancelación:</strong> <a class="link" href="${cancelUrl}" target="_blank" rel="noopener">clic aquí</a></div>
            ${aliasBlock}
          </div>
          <p class="small mt-2 text-muted mb-0">Muchas Gracias por elegirnos!! <strong> Te esperamos!</strong>.</p>
        `,
        confirmButtonText:'Guardar y salir',
        confirmButtonColor:'#ec4899'
      });

      // Reset de campos mínimos
      nameInp.value=''; phoneInp.value=''; notesInp.value='';
      await refreshTimes();
      Toast.fire({icon:'success', title:'Reserva guardada'});
    } catch(e){
      console.error(e);
      Swal.fire({icon:'error', title:'No se pudo reservar', text:'Intentá nuevamente.', confirmButtonColor:'#ec4899'});
    } finally {
      reserveBtn.classList.remove('is-loading'); reserveBtn.removeAttribute('disabled');
    }
  });
})();
