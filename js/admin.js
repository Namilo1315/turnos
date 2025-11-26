// ===== ADMIN (Panel) — compatible con Firestore (DB.*) =====

/* Helpers */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmtARS = n =>
  Number(n || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  });

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtFullDate = iso => {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const wd = dt
      .toLocaleDateString("es-AR", { weekday: "short" })
      .toLowerCase();
    const date = dt.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    return `${wd} ${date}`;
  } catch {
    return iso;
  }
};

const ymKey = isoDate => isoDate?.slice(0, 7);
const firstDayOfMonth = ym => `${ym}-01`;
const lastDayOfMonth = ym => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0, 10);
};

/* ===== Base pública (GitHub Pages) =====
   Si cambiás la URL del proyecto, actualizá esta constante.
*/
const PUBLIC_BASE = "https://namilo1315.github.io/turnosonline/";

/* ===== Helpers nuevos (WA + disponibilidad + cancel URL) ===== */
function safePhoneAR(raw) {
  let p = String(raw || "").replace(/\D/g, "");
  if (!p.startsWith("54")) p = "54" + p;
  return p;
}

function minutes(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function overlap(aStart, aDur, bStart, bDur) {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

/** Link público a cancel.html con id + token */
function buildCancelUrl(b) {
  return (
    PUBLIC_BASE +
    "cancel.html?id=" +
    encodeURIComponent(b.id) +
    "&token=" +
    encodeURIComponent(b.cancelToken || "")
  );
}

/** Mensaje de WhatsApp: solo texto, sin emojis, última línea = solo URL */
function buildWhatsAppLink(b, svcName) {
  const brand =
    typeof SETTINGS?.brand === "string" && SETTINGS.brand.trim()
      ? SETTINGS.brand
      : "Estética Bellezza";

  const cancelUrl = buildCancelUrl(b);

  const textLines = [
    `Hola ${b.name}, te escribimos de ${brand}.`,
    ``,
    `Detalle de tu turno:`,
    `- Servicio: ${svcName}`,
    `- Fecha: ${fmtFullDate(b.date)}`,
    `- Hora: ${b.time} hs`,
    ``,
    `Para confirmar el turno respondé solo con la palabra: SI`,
    ``,
    `Si necesitás cancelar tu turno, abrí este enlace:`,
    `${cancelUrl}` // última línea: solo la URL
  ];

  const text = textLines.join("\n");

  return `https://wa.me/${safePhoneAR(b.phone)}?text=${encodeURIComponent(
    text
  )}`;
}

async function isTimeFree(date, time, svcId) {
  const svc = SERVICES.find(s => s.id === svcId);
  const dur = parseInt(svc?.duration || 30, 10);
  const start = minutes(time);
  const sameDay = BOOKINGS.filter(
    b => b.date === date && b.status !== "cancelado"
  );
  for (const b of sameDay) {
    const s2 = SERVICES.find(s => s.id === b.serviceId);
    const dur2 = parseInt(s2?.duration || 30, 10);
    if (overlap(start, dur, minutes(b.time), dur2)) return false;
  }
  return true;
}

async function ensureCancelTokens() {
  let touched = 0;
  for (const b of BOOKINGS) {
    if (!b.cancelToken) {
      const newToken =
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 10);
      await updateBookingSafe(b.id, { cancelToken: newToken });
      touched++;
    }
  }
  if (touched > 0) {
    await loadAllData();
  }
}

/* DOM refs */
const loginBox = $("#loginBox");
const appBox = $("#app");
const pinInp = $("#pin");
const inBtn = $("#inBtn");
const logoutBtn = $("#logoutBtn");

const kpiRevenue = $("#kpiRevenue");
const kpiBookings = $("#kpiBookings");
const kpiCancel = $("#kpiCancel");

const a_svc = $("#a_svc");
const a_date = $("#a_date");
const a_time = $("#a_time");
const a_name = $("#a_name");
const a_phone = $("#a_phone");
const a_notes = $("#a_notes");
const a_add = $("#a_add");

const filter_date = $("#filter_date");
const clear_filter = $("#clear_filter");
const exportCsv = $("#exportCsv");
const agendaTable = $("#agendaTable");

const chartDaysCanvas = $("#chartDays");
const chartServicesCanvas = $("#chartServices");

const c_open = $("#c_open");
const c_close = $("#c_close");
const c_slot = $("#c_slot");
const c_wa = $("#c_wa");
const c_pay = $("#c_pay");
const c_save = $("#c_save");

const svc_list = $("#svc_list");
const svc_add = $("#svc_add");

const publicLink = $("#publicLink");
const copyLink = $("#copyLink");
const qrBox = $("#qr");

/* Estado */
let SETTINGS = {};
let SERVICES = [];
let BOOKINGS = [];
let chartDays, chartServices;

/* ========= Autenticación ========= */
async function getPinFromSettings() {
  try {
    const s = await DB.getSettings();
    return s && s.admin_pin ? String(s.admin_pin) : "1234";
  } catch {
    return "1234";
  }
}
function isAuthed() {
  return sessionStorage.getItem("adminAuth") === "true";
}
function setAuthed(v) {
  sessionStorage.setItem("adminAuth", v ? "true" : "false");
}
async function showLogin() {
  loginBox.classList.remove("d-none");
  appBox.classList.add("d-none");
  pinInp?.focus();
}
async function showApp() {
  loginBox.classList.add("d-none");
  appBox.classList.remove("d-none");
  await loadAllData();
  await ensureCancelTokens(); // completa tokens que falten
  await renderAll();
}

/* ========= Carga de datos ========= */
async function loadAllData() {
  SETTINGS = (await DB.getSettings()) || {};
  SERVICES = (await DB.listServices()) || [];
  BOOKINGS = (await DB.listBookings()) || [];
}

/* ========= Render general ========= */
async function renderAll() {
  ensureMonthSelector();
  fillMonthSelector();
  renderKPIs();
  renderNewBookingForm();
  renderAgenda();
  renderConfig();
  renderServiceAdminList();
  renderPublicLink();
  renderCharts();
}

/* ========= Scope & filtros ========= */
function currentScope() {
  const day = (filter_date?.value || "").trim();
  const monthSel = $("#filter_month");
  const ym = monthSel ? monthSel.value || "" : "";
  if (day) return { type: "day", day };
  if (ym) return { type: "month", ym };
  return { type: "month", ym: ymKey(todayISO()) };
}

function filterBookingsByScope(list) {
  const scope = currentScope();
  if (scope.type === "day") {
    return list.filter(b => b.date === scope.day);
  } else {
    return list.filter(b => b.date?.startsWith(scope.ym));
  }
}

/* ========= KPIs ========= */
function renderKPIs() {
  const mapSvc = Object.fromEntries(SERVICES.map(s => [s.id, s]));
  const scoped = filterBookingsByScope(BOOKINGS);

  let revenue = 0,
    count = 0,
    cancel = 0;
  scoped.forEach(b => {
    if (b.status === "cancelado") {
      cancel++;
      return;
    }
    count++;
    revenue += Number(mapSvc[b.serviceId]?.price || 0);
  });

  kpiRevenue.textContent = fmtARS(revenue);
  kpiBookings.textContent = String(count);
  kpiCancel.textContent = String(cancel);
}

/* ========= Nuevo turno ========= */
function renderNewBookingForm() {
  a_svc.innerHTML = SERVICES.map(
    s =>
      `<option value="${s.id}" data-duration="${s.duration}">${s.name} — ${fmtARS(
        s.price
      )}</option>`
  ).join("");
  if (!a_svc.value && SERVICES[0]) a_svc.value = SERVICES[0].id;
  a_date.value = todayISO();
  if (!a_time.value) a_time.value = "09:00";
}

/* ========= Agenda ========= */
function renderAgenda() {
  const mapSvc = Object.fromEntries(SERVICES.map(s => [s.id, s]));
  const items = filterBookingsByScope(BOOKINGS).sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time)
  );

  agendaTable.innerHTML = items
    .map(b => {
      const svc = mapSvc[b.serviceId];
      const stateBadge =
        b.status === "cancelado"
          ? '<span class="badge bg-light text-danger">Cancelado</span>'
          : '<span class="badge bg-light text-success">Confirmado</span>';

      const wa =
        b.phone && svc ? buildWhatsAppLink(b, svc.name || "-") : "#";

      return `<tr data-id="${b.id}">
      <td>${fmtFullDate(b.date)}</td>
      <td>${b.time}</td>
      <td>${svc?.name || "-"}</td>
      <td>${b.name || "-"}</td>
      <td><a href="${wa}" target="_blank" rel="noopener">${b.phone || "-"}</a></td>
      <td>${stateBadge}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn btn-outline-secondary" data-act="cancel">Cancelar</button>
          <button type="button" class="btn btn-outline-secondary" data-act="delete">Borrar</button>
        </div>
      </td>
    </tr>`;
    })
    .join("");

  // Scroll en tabla (visible ~10 filas)
  const wrap = agendaTable.closest(".table-responsive");
  if (wrap) {
    wrap.style.maxHeight = "420px";
    wrap.style.overflowY = "auto";
  }

  agendaTable.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = tr?.dataset.id;
      if (!id) return;
      const act = btn.dataset.act;
      try {
        if (act === "cancel") {
          await updateBookingSafe(id, { status: "cancelado" });
        } else if (act === "delete") {
          await deleteBookingSafe(id);
        }
        await loadAllData();
        renderKPIs();
        renderAgenda();
        renderCharts();
      } catch (e) {
        Swal.fire({
          icon: "error",
          title: "Ups",
          text: e.message || "No se pudo completar la acción"
        });
      }
    });
  });
}

/* ========= Filtros & Export ========= */
filter_date.addEventListener("change", () => {
  const monthSel = $("#filter_month");
  if (filter_date.value && monthSel) monthSel.value = "";
  renderKPIs();
  renderAgenda();
  renderCharts();
});

clear_filter.addEventListener("click", () => {
  filter_date.value = "";
  const monthSel = $("#filter_month");
  if (monthSel) {
    monthSel.value = ymKey(todayISO());
  }
  renderKPIs();
  renderAgenda();
  renderCharts();
});

exportCsv.addEventListener("click", () => {
  const mapSvc = Object.fromEntries(SERVICES.map(s => [s.id, s]));
  const scoped = filterBookingsByScope(BOOKINGS);
  const rows = [["Fecha", "Hora", "Servicio", "Cliente", "WhatsApp", "Estado"]];
  scoped.forEach(b => {
    rows.push([
      b.date,
      b.time,
      mapSvc[b.serviceId]?.name || "",
      b.name || "",
      b.phone || "",
      b.status || ""
    ]);
  });
  const csv = rows
    .map(r =>
      r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agenda.csv";
  a.click();
  URL.revokeObjectURL(url);
});

/* ========= Month selector (inyectado) ========= */
function ensureMonthSelector() {
  if ($("#filter_month")) return;
  const wrap =
    filter_date?.parentElement?.parentElement ||
    filter_date?.parentElement ||
    document;
  const sel = document.createElement("select");
  sel.id = "filter_month";
  sel.className = "form-select form-select-sm";
  sel.style.minWidth = "160px";
  sel.title = "Filtrar por mes";
  const target = clear_filter?.parentElement || wrap;
  target.insertBefore(sel, target.firstChild);
  sel.addEventListener("change", () => {
    if (sel.value) filter_date.value = "";
    renderKPIs();
    renderAgenda();
    renderCharts();
  });
}

function fillMonthSelector() {
  const sel = $("#filter_month");
  if (!sel) return;
  const months = new Set(BOOKINGS.map(b => ymKey(b.date)).filter(Boolean));
  months.add(ymKey(todayISO()));
  const list = Array.from(months).sort().reverse();
  const label = ym => {
    const [y, m] = ym.split("-").map(Number);
    const dt = new Date(y, m - 1, 1);
    return dt.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric"
    });
  };
  const prev = sel.value;
  sel.innerHTML = list
    .map(ym => `<option value="${ym}">${label(ym)}</option>`)
    .join("");
  sel.value = prev || ymKey(todayISO());
}

/* ========= Config ========= */
function renderConfig() {
  c_open.value = SETTINGS.open || "09:00";
  c_close.value = SETTINGS.close || "18:00";
  c_slot.value = SETTINGS.slot || 30;
  c_wa.value = SETTINGS.wa || "5492616246767";
  c_pay.value = SETTINGS.pay_alias || SETTINGS.pay || "";
}

async function saveSettings(obj) {
  const next = { ...SETTINGS, ...obj };
  if (typeof DB.saveSettings === "function") {
    await DB.saveSettings(next);
  } else if (typeof DB.setSettings === "function") {
    await DB.setSettings(next);
  } else {
    localStorage.setItem("settings_fallback", JSON.stringify(next));
  }
  SETTINGS = next;
}

c_save.addEventListener("click", async () => {
  await saveSettings({
    open: c_open.value,
    close: c_close.value,
    slot: parseInt(c_slot.value || 30, 10),
    wa: c_wa.value,
    pay_alias: c_pay.value,
    pay: c_pay.value
  });
  Swal.fire({
    icon: "success",
    title: "Guardado",
    timer: 1200,
    showConfirmButton: false
  });
});

/* ========= Servicios — SAFE OPS ========= */
async function addServiceSafe(svc) {
  if (typeof DB.addService === "function") return await DB.addService(svc);
  if (typeof DB.createService === "function")
    return await DB.createService(svc);
  if (
    typeof DB.listServices === "function" &&
    typeof DB.saveServices === "function"
  ) {
    const all = await DB.listServices();
    all.push(svc);
    return await DB.saveServices(all);
  }
  throw new Error("No se pudo agregar el servicio");
}

async function updateServiceSafe(id, patch) {
  if (typeof DB.updateService === "function")
    return await DB.updateService(id, patch);
  if (typeof DB.setService === "function")
    return await DB.setService(id, patch);
  if (
    typeof DB.listServices === "function" &&
    typeof DB.saveServices === "function"
  ) {
    const all = await DB.listServices();
    const next = all.map(s => (s.id === id ? { ...s, ...patch } : s));
    return await DB.saveServices(next);
  }
  throw new Error("No se pudo actualizar el servicio");
}

async function deleteServiceSafe(id) {
  if (typeof DB.deleteService === "function")
    return await DB.deleteService(id);
  if (typeof DB.removeService === "function")
    return await DB.removeService(id);
  if (
    typeof DB.listServices === "function" &&
    typeof DB.saveServices === "function"
  ) {
    const all = await DB.listServices();
    const next = all.filter(s => s.id !== id);
    return await DB.saveServices(next);
  }
  throw new Error("No se pudo borrar el servicio");
}

/* ========= Servicios (UI Config) ========= */
function renderServiceAdminList() {
  svc_list.innerHTML = SERVICES.map(
    s => `
    <div class="border rounded p-2 d-flex align-items-center justify-content-between mb-2" data-id="${s.id}">
      <div class="d-flex align-items-center gap-2">
        <span class="d-inline-block rounded-circle" style="width:12px;height:12px;background:${s.color ||
          "#ec4899"}"></span>
        <strong>${s.name}</strong> · ${fmtARS(s.price)} · ${s.duration} min
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-secondary" data-act="edit">Editar</button>
        <button class="btn btn-sm btn-outline-secondary" data-act="del">Borrar</button>
      </div>
    </div>
  `
  ).join("");

  // acciones fila
  svc_list.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-id]");
      const id = row?.dataset.id;
      if (!id) return;
      const s = SERVICES.find(x => x.id === id);
      if (!s) return;

      try {
        if (btn.dataset.act === "del") {
          const ok = await Swal.fire({
            icon: "warning",
            title: "¿Borrar servicio?",
            showCancelButton: true,
            confirmButtonText: "Borrar",
            confirmButtonColor: "#ec4899"
          });
          if (ok.isConfirmed) {
            await deleteServiceSafe(id);
            await reloadEverywhere();
            Swal.fire({
              icon: "success",
              title: "Servicio borrado",
              timer: 1100,
              showConfirmButton: false
            });
          }
        } else {
          const { value: formValues } = await Swal.fire({
            title: "Editar servicio",
            html: `
              <input id="svcn" class="swal2-input" placeholder="Nombre" value="${s.name}">
              <input id="svcp" class="swal2-input" placeholder="Precio" type="number" value="${s.price}">
              <input id="svcd" class="swal2-input" placeholder="Duración (min)" type="number" value="${s.duration}">
              <input id="svcc" class="swal2-input" placeholder="Color" value="${s.color ||
                "#ec4899"}">
            `,
            focusConfirm: false,
            confirmButtonText: "Guardar",
            confirmButtonColor: "#ec4899",
            preConfirm: () => ({
              name: document.getElementById("svcn").value.trim(),
              price: parseInt(
                document.getElementById("svcp").value || 0,
                10
              ),
              duration: parseInt(
                document.getElementById("svcd").value || 30,
                10
              ),
              color: document.getElementById("svcc").value.trim()
            })
          });
          if (formValues) {
            await updateServiceSafe(id, formValues);
            await reloadEverywhere();
            Swal.fire({
              icon: "success",
              title: "Servicio actualizado",
              timer: 1100,
              showConfirmButton: false
            });
          }
        }
      } catch (e) {
        Swal.fire({
          icon: "error",
          title: "Ups",
          text: e.message || "No se pudo completar la acción"
        });
      }
    });
  });

  // botón Agregar (bind una sola vez)
  if (!svc_add.dataset.bound) {
    svc_add.dataset.bound = "1";
    svc_add.addEventListener("click", async () => {
      const { value: formValues } = await Swal.fire({
        title: "Nuevo servicio",
        html: `
          <input id="svcn" class="swal2-input" placeholder="Nombre">
          <input id="svcp" class="swal2-input" placeholder="Precio" type="number">
          <input id="svcd" class="swal2-input" placeholder="Duración (min)" type="number" value="30">
          <input id="svcc" class="swal2-input" placeholder="Color" value="#ec4899">
        `,
        focusConfirm: false,
        confirmButtonText: "Agregar",
        confirmButtonColor: "#ec4899",
        preConfirm: () => {
          const payload = {
            id: "svc_" + Math.random().toString(36).slice(2, 8),
            name: document.getElementById("svcn").value.trim(),
            price: parseInt(
              document.getElementById("svcp").value || 0,
              10
            ),
            duration: parseInt(
              document.getElementById("svcd").value || 30,
              10
            ),
            color: document.getElementById("svcc").value.trim()
          };
          if (!payload.name) Swal.showValidationMessage("Ingresá un nombre");
          return payload;
        }
      });
      if (formValues) {
        try {
          await addServiceSafe(formValues);
          await reloadEverywhere();
          Swal.fire({
            icon: "success",
            title: "Servicio agregado",
            timer: 1100,
            showConfirmButton: false
          });
        } catch (e) {
          Swal.fire({
            icon: "error",
            title: "Ups",
            text: e.message || "No se pudo agregar"
          });
        }
      }
    });
  }
}

/* ========= Link público + QR ========= */
function renderPublicLink() {
  // Usamos también la URL pública para compartir
  const link = PUBLIC_BASE + "index.html";
  publicLink.value = link;

  copyLink.addEventListener(
    "click",
    () => {
      navigator.clipboard.writeText(link);
      copyLink.textContent = "Copiado";
      setTimeout(() => (copyLink.textContent = "Copiar"), 1200);
    },
    { once: true }
  );

  if (window.QRCode) {
    qrBox.innerHTML = "";
    QRCode.toCanvas(
      document.createElement("canvas"),
      link,
      { width: 220 },
      (err, canvas) => {
        if (!err) {
          qrBox.appendChild(canvas);
        }
      }
    );
  }
}

/* ========= Bookings SAFE ========= */
async function deleteBookingSafe(id) {
  try {
    if (typeof DB.deleteBooking === "function")
      return await DB.deleteBooking(id);
    if (typeof DB.removeBooking === "function")
      return await DB.removeBooking(id);
    if (typeof DB.delBooking === "function")
      return await DB.delBooking(id);
    if (
      typeof DB.listBookings === "function" &&
      typeof DB.saveBookings === "function"
    ) {
      const all = await DB.listBookings();
      const next = all.filter(b => b.id !== id);
      return await DB.saveBookings(next);
    }
  } catch (e) {
    console.error("deleteBookingSafe:", e);
  }
  throw new Error("No se pudo borrar el turno");
}

async function updateBookingSafe(id, patch) {
  try {
    if (typeof DB.updateBooking === "function")
      return await DB.updateBooking(id, patch);
    if (typeof DB.setBooking === "function")
      return await DB.setBooking(id, patch);
    if (
      typeof DB.listBookings === "function" &&
      typeof DB.saveBookings === "function"
    ) {
      const all = await DB.listBookings();
      const next = all.map(b =>
        b.id === id ? { ...b, ...patch } : b
      );
      return await DB.saveBookings(next);
    }
  } catch (e) {
    console.error("updateBookingSafe:", e);
  }
  throw new Error("No se pudo actualizar el turno");
}

/* ========= Gráficos (Chart.js) ========= */
function renderCharts() {
  if (!window.Chart) return;

  const brand = "#ec4899",
    soft = "rgba(236,72,153,0.12)";
  const rosePalette = [
    "#ec4899",
    "#f472b6",
    "#fb7185",
    "#fda4af",
    "#f9a8d4",
    "#e879f9",
    "#fca5a5"
  ];

  const scoped = filterBookingsByScope(BOOKINGS);
  const mapSvc = Object.fromEntries(SERVICES.map(s => [s.id, s]));

  const scope = currentScope();
  let days = [];
  if (scope.type === "day") {
    days = [scope.day];
  } else {
    const ym = scope.ym;
    const start = new Date(firstDayOfMonth(ym));
    const end = new Date(lastDayOfMonth(ym));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().slice(0, 10));
    }
  }
  const countByDay = days.map(
    d =>
      scoped.filter(
        b => b.date === d && b.status !== "cancelado"
      ).length
  );

  const svcCount = {};
  scoped.forEach(b => {
    if (b.status === "cancelado") return;
    const key = mapSvc[b.serviceId]?.name || "Otro";
    svcCount[key] = (svcCount[key] || 0) + 1;
  });
  const svcLabels = Object.keys(svcCount);
  const svcValues = svcLabels.map(k => svcCount[k]);
  const totalTurnos = svcValues.reduce((a, b) => a + b, 0);

  if (chartDays) chartDays.destroy();
  if (chartServices) chartServices.destroy();

  const centerTextPlugin = {
    id: "centerText",
    afterDraw(chart) {
      if (chart.config.type !== "doughnut") return;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      const { ctx } = chart;
      const { x: cx, y: cy } = meta.data[0];
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#374151";
      ctx.font =
        "600 16px Inter, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillText("Turnos", cx, cy - 6);
      ctx.font =
        "900 24px Inter, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = brand;
      ctx.fillText(String(totalTurnos), cx, cy + 22);
      ctx.restore();
    }
  };

  const outerLabelsPlugin = {
    id: "outerLabels",
    afterDatasetsDraw(chart) {
      if (chart.config.type !== "doughnut") return;
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;
      const padText = 6,
        padEdge = 12;
      ctx.save();
      ctx.font =
        "600 12px Inter, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "#374151";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;

      meta.data.forEach((arc, i) => {
        const {
          x,
          y,
          startAngle,
          endAngle,
          outerRadius
        } = arc.getProps(
          ["x", "y", "startAngle", "endAngle", "outerRadius"],
          true
        );
        const mid = (startAngle + endAngle) / 2;

        const x1 = x + Math.cos(mid) * (outerRadius + 6);
        const y1 = y + Math.sin(mid) * (outerRadius + 6);

        let x2 = x + Math.cos(mid) * (outerRadius + 16);
        let y2 = y + Math.sin(mid) * (outerRadius + 16);

        x2 = Math.max(
          chartArea.left + padEdge,
          Math.min(chartArea.right - padEdge, x2)
        );
        y2 = Math.max(
          chartArea.top + padEdge,
          Math.min(chartArea.bottom - padEdge, y2)
        );

        const alignRight = x2 >= x;
        const x3 = x2 + (alignRight ? 12 : -12);
        const y3 = y2;

        const label = `${chart.data.labels[i]}: ${
          chart.data.datasets[0].data[i]
        }`;
        ctx.textAlign = alignRight ? "left" : "right";
        ctx.textBaseline = "middle";

        const textX = Math.max(
          chartArea.left + padEdge,
          Math.min(
            chartArea.right - padEdge,
            x3 + (alignRight ? padText : -padText)
          )
        );
        const textY = Math.max(
          chartArea.top + padEdge,
          Math.min(chartArea.bottom - padEdge, y3)
        );

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();

        ctx.fillText(label, textX, textY);
      });
      ctx.restore();
    }
  };

  // Línea
  chartDays = new Chart(chartDaysCanvas, {
    type: "line",
    data: {
      labels: days.map(d =>
        scope.type === "day"
          ? d.slice(5).replace("-", "/")
          : d.slice(8, 10)
      ),
      datasets: [
        {
          label: "Turnos por día",
          data: countByDay,
          borderColor: brand,
          backgroundColor: soft,
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#fff",
          pointBorderColor: brand
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#fff",
          bodyColor: "#fff",
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} turno(s)`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6b7280", font: { family: "Inter" } }
        },
        y: {
          beginAtZero: true,
          grid: { color: "#ffe4e6" },
          ticks: {
            stepSize: 1,
            color: "#6b7280",
            font: { family: "Inter" }
          }
        }
      }
    }
  });

  // Anillo
  const bgColors = svcLabels.map(
    (_, i) => rosePalette[i % rosePalette.length]
  );
  chartServices = new Chart(chartServicesCanvas, {
    type: "doughnut",
    data: {
      labels: svcLabels,
      datasets: [
        {
          data: svcValues,
          backgroundColor: bgColors,
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 8,
          spacing: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      layout: {
        padding: { top: 22, right: 18, bottom: 22, left: 18 }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#374151",
            font: { family: "Inter", weight: 600 },
            boxWidth: 10,
            boxHeight: 10,
            padding: 10
          }
        },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#fff",
          bodyColor: "#fff",
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} turno(s)`
          }
        }
      }
    },
    plugins: [centerTextPlugin, outerLabelsPlugin]
  });
}

/* ========= Recarga integral tras cambios estructurales ========= */
async function reloadEverywhere() {
  await loadAllData();
  fillMonthSelector();
  renderServiceAdminList();
  renderNewBookingForm();
  renderKPIs();
  renderAgenda();
  renderCharts();
}

/* ========= Eventos globales ========= */
// Login
inBtn?.addEventListener("click", async () => {
  const pin = (pinInp.value || "").trim();
  const realPin = await getPinFromSettings();
  if (pin && pin === String(realPin)) {
    setAuthed(true);
    await showApp();
  } else {
    Swal.fire({
      icon: "error",
      title: "PIN incorrecto",
      confirmButtonColor: "#ec4899"
    });
  }
});

pinInp?.addEventListener("keydown", e => {
  if (e.key === "Enter") inBtn.click();
});

// Logout
logoutBtn?.addEventListener("click", () => {
  setAuthed(false);
  showLogin();
});

// Crear nuevo turno (con manejo de solapamiento y SLOT_TAKEN DB)
a_add?.addEventListener("click", async () => {
  const svc = SERVICES.find(s => s.id === a_svc.value);
  const date = a_date.value;
  const time = a_time.value;
  const name = a_name.value.trim();
  const phone = (a_phone.value || "").replace(/\D/g, "");
  const notes = a_notes.value.trim();

  if (!svc || !date || !time || !name || !phone) {
    Swal.fire({
      icon: "warning",
      title: "Completá servicio, fecha, hora, cliente y WhatsApp",
      confirmButtonColor: "#ec4899"
    });
    return;
  }

  // Chequeo de solapamiento en cliente (además del control en DB si lo tenés)
  const free = await isTimeFree(date, time, svc.id);
  if (!free) {
    Swal.fire({
      icon: "warning",
      title: "Horario no disponible",
      text: "Ese horario se superpone con otro turno."
    });
    return;
  }

  const booking = {
    id: "bk_" + Math.random().toString(36).slice(2, 8),
    date,
    time,
    serviceId: svc.id,
    name,
    phone,
    notes,
    status: "confirmado",
    createdAt: Date.now(),
    cancelToken: Math.random().toString(36).slice(2, 10),
    reminders: { h2: false }
  };

  try {
    if (typeof DB.addBooking === "function") await DB.addBooking(booking);
    else if (typeof DB.createBooking === "function")
      await DB.createBooking(booking);
    else {
      // fallback
      const all = await DB.listBookings();
      all.push(booking);
      await DB.saveBookings(all);
    }
    a_name.value = "";
    a_phone.value = "";
    a_notes.value = "";
    await loadAllData();
    renderKPIs();
    renderAgenda();
    renderCharts();
  } catch (e) {
    const msg =
      e && (e.code === "SLOT_TAKEN" || /SLOT_TAKEN/.test(e.message))
        ? "Ese horario ya está ocupado."
        : e.message || "No se pudo crear el turno";
    Swal.fire({
      icon: "error",
      title: "No se pudo crear el turno",
      text: msg,
      confirmButtonColor: "#ec4899"
    });
  }
});

// Al cargar
document.addEventListener("DOMContentLoaded", async () => {
  if (isAuthed()) await showApp();
  else await showLogin();
});
